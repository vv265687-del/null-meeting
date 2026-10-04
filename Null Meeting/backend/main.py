from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from database import engine, Base, get_db
from models import User
from meeting_model import Meeting
from auth import verify_password, hash_password, create_access_token, SECRET_KEY, ALGORITHM
import random
import asyncio

Base.metadata.create_all(bind=engine)

app = FastAPI(title="PROJECT-X API", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

security = HTTPBearer()

# Runtime meeting state. This is intentionally in memory for the live meeting layer.
# Database remains responsible for users and meeting records.
meeting_rooms = {}


def decode_access_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        return int(user_id) if user_id is not None else None
    except (JWTError, ValueError, TypeError):
        return None


def get_room(meeting_id):
    return meeting_rooms.setdefault(meeting_id, {
        "active": [],
        "waiting": [],
        "locked": False,
        "waiting_room": True,
        "ended": False,
    })


def public_participant(p):
    return {
        "participant_id": p["participant_id"],
        "user_id": p["user_id"],
        "name": p["name"],
        "is_host": p["is_host"],
        "raised_hand": p.get("raised_hand", False),
        "muted": p.get("muted", False),
    }


def public_waiting(p):
    return {
        "participant_id": p["participant_id"],
        "user_id": p["user_id"],
        "name": p["name"],
        "is_host": p["is_host"],
    }


async def send_json_safe(ws, data):
    try:
        await ws.send_json(data)
        return True
    except Exception:
        return False


async def broadcast_active(meeting_id, data, exclude=None):
    room = meeting_rooms.get(meeting_id)
    if not room:
        return
    for p in list(room["active"]):
        if exclude and p["participant_id"] == exclude:
            continue
        await send_json_safe(p["websocket"], data)


async def send_room_info(p, meeting_id):
    room = meeting_rooms[meeting_id]
    roster = [public_participant(x) for x in room["active"]]
    await send_json_safe(p["websocket"], {
        "type": "room_info",
        "meeting_id": meeting_id,
        "participant_id": p["participant_id"],
        "user_id": p["user_id"],
        "name": p["name"],
        "is_host": p["is_host"],
        "host_id": p["host_id"],
        "participants": len(room["active"]),
        "locked": room["locked"],
        "waiting_room": room["waiting_room"],
        "participant_details": roster,
        "existing_participants": [x["participant_id"] for x in room["active"] if x["participant_id"] != p["participant_id"]],
        "existing_participant_details": [x for x in roster if x["participant_id"] != p["participant_id"]],
    })


@app.websocket("/ws/{meeting_id}")
async def meeting_websocket(websocket: WebSocket, meeting_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        print("WebSocket rejected: Token missing")
        return

    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=1008)
        print("WebSocket rejected: Invalid token")
        return

    db = next(get_db())
    active_participant = None
    waiting_participant = None
    admitted = False

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=1008)
            return

        meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
        if not meeting:
            await websocket.close(code=1008)
            print("WebSocket rejected: Meeting not found", meeting_id)
            return

        room = get_room(meeting_id)
        if room["ended"]:
            await websocket.accept()
            await websocket.send_json({"type": "end_meeting", "message": "This meeting has ended."})
            await websocket.close(code=1000)
            return

        # One account gets one live participant entry per meeting. A browser
        # refresh/reconnect can otherwise leave the old socket in the in-memory
        # room briefly, producing duplicate video cards for the same person.
        stale_entries = [
            x for x in (room["active"] + room["waiting"])
            if x.get("user_id") == user.id
        ]
        for stale in stale_entries:
            if stale in room["active"]:
                room["active"].remove(stale)
                await broadcast_active(meeting_id, {
                    "type": "user_left",
                    "participant_id": stale["participant_id"],
                    "user_id": stale["user_id"],
                    "name": stale["name"],
                    "is_host": stale["is_host"],
                    "participants": len(room["active"]),
                })
            if stale in room["waiting"]:
                room["waiting"].remove(stale)
            try:
                await stale["websocket"].close(code=4001)
            except Exception:
                pass

        is_host = meeting.host_id == user.id
        await websocket.accept()

        participant_id = str(random.randint(100000, 999999))
        used_ids = {p["participant_id"] for p in room["active"] + room["waiting"]}
        while participant_id in used_ids:
            participant_id = str(random.randint(100000, 999999))

        base = {
            "participant_id": participant_id,
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "is_host": is_host,
            "host_id": meeting.host_id,
            "websocket": websocket,
            "raised_hand": False,
            "muted": False,
        }

        # Host always enters immediately. Everyone else uses the waiting room
        # while it is enabled, or when the host has locked the meeting.
        must_wait = (not is_host) and (room["waiting_room"] or room["locked"])

        if must_wait:
            waiting_participant = base
            room["waiting"].append(waiting_participant)
            await websocket.send_json({
                "type": "waiting_room",
                "meeting_id": meeting_id,
                "participant_id": participant_id,
                "name": user.name,
                "message": "Please wait. The host will let you into the meeting.",
                "locked": room["locked"],
            })

            await broadcast_active(meeting_id, {
                "type": "join_request",
                "participant_id": participant_id,
                "user_id": user.id,
                "name": user.name,
                "is_host": False,
                "waiting_count": len(room["waiting"]),
            })
        else:
            active_participant = base
            room["active"].append(active_participant)
            admitted = True
            await send_room_info(active_participant, meeting_id)
            await broadcast_active(meeting_id, {
                "type": "user_joined",
                "participant_id": participant_id,
                "user_id": user.id,
                "name": user.name,
                "is_host": is_host,
                "participants": len(room["active"]),
            }, exclude=participant_id)

        print(f"Connected: {user.name} | id={participant_id} | host={is_host} | waiting={must_wait}")

        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")
            target_id = message.get("target_id")

            # A waiting participant can be moved to the active list by the
            # host from a DIFFERENT websocket coroutine. Synchronize the
            # local coroutine state from the authoritative room before
            # applying the waiting-room gate. Without this, the admitted
            # participant's WebRTC offers/answers/ICE were silently ignored.
            if not admitted:
                current_active = next(
                    (x for x in room["active"] if x["participant_id"] == participant_id),
                    None,
                )
                if current_active:
                    active_participant = current_active
                    waiting_participant = None
                    admitted = True

            # Waiting users may only request to leave/cancel until they are
            # actually present in room["active"].
            if not admitted:
                if message_type == "leave_waiting":
                    break
                if message_type not in {"heartbeat"}:
                    continue

            message["sender_id"] = participant_id
            message["sender_user_id"] = user.id
            message["sender_name"] = user.name
            message["sender_is_host"] = is_host

            host_only = {"mute_participant", "remove_participant", "lock_meeting", "end_meeting", "admit_participant", "reject_participant", "waiting_room_toggle"}
            if message_type in host_only and not is_host:
                await websocket.send_json({"type": "error", "message": "Only the meeting host can perform this action."})
                continue

            room = meeting_rooms.get(meeting_id)
            if not room:
                break

            # Host admission from waiting room.
            if message_type == "admit_participant":
                pending = next((x for x in room["waiting"] if x["participant_id"] == target_id), None)
                if not pending:
                    await websocket.send_json({"type": "error", "message": "Waiting participant not found."})
                    continue
                room["waiting"] = [x for x in room["waiting"] if x["participant_id"] != target_id]
                room["active"].append(pending)
                pending["waiting"] = False
                if pending["participant_id"] == participant_id:
                    active_participant = pending
                    waiting_participant = None
                    admitted = True
                await send_room_info(pending, meeting_id)
                await send_json_safe(pending["websocket"], {"type": "admitted", "message": "The host admitted you into the meeting."})
                await broadcast_active(meeting_id, {
                    "type": "user_joined",
                    "participant_id": pending["participant_id"],
                    "user_id": pending["user_id"],
                    "name": pending["name"],
                    "is_host": False,
                    "participants": len(room["active"]),
                }, exclude=pending["participant_id"])
                await websocket.send_json({"type": "waiting_updated", "waiting": [public_waiting(x) for x in room["waiting"]]})
                continue

            if message_type == "reject_participant":
                pending = next((x for x in room["waiting"] if x["participant_id"] == target_id), None)
                if pending:
                    room["waiting"].remove(pending)
                    await send_json_safe(pending["websocket"], {"type": "rejected", "message": "The host did not admit you to the meeting."})
                    try:
                        await pending["websocket"].close(code=1000)
                    except Exception:
                        pass
                await websocket.send_json({"type": "waiting_updated", "waiting": [public_waiting(x) for x in room["waiting"]]})
                continue

            if message_type == "waiting_room_toggle":
                room["waiting_room"] = bool(message.get("enabled", True))
                await broadcast_active(meeting_id, {
                    "type": "waiting_room_state",
                    "enabled": room["waiting_room"],
                    "locked": room["locked"],
                })
                await websocket.send_json({"type": "waiting_updated", "waiting": [public_waiting(x) for x in room["waiting"]]})
                continue

            if message_type == "lock_meeting":
                room["locked"] = bool(message.get("locked", False))
                await broadcast_active(meeting_id, {
                    "type": "lock_meeting",
                    "locked": room["locked"],
                })
                continue

            if message_type == "end_meeting":
                room["ended"] = True
                everyone = list(room["active"]) + list(room["waiting"])
                for p in everyone:
                    await send_json_safe(p["websocket"], {"type": "end_meeting", "message": "The host ended the meeting."})
                    try:
                        await p["websocket"].close(code=1000)
                    except Exception:
                        pass
                room["active"].clear()
                room["waiting"].clear()
                break

            if message_type == "remove_participant":
                target = next((x for x in room["active"] if x["participant_id"] == target_id), None)
                if target and target["participant_id"] != participant_id:
                    await send_json_safe(target["websocket"], {"type": "removed", "message": "The host removed you from the meeting."})
                    try:
                        await target["websocket"].close(code=1000)
                    except Exception:
                        pass
                continue

            if message_type == "mute_participant":
                target = next((x for x in room["active"] if x["participant_id"] == target_id), None)
                if target:
                    target["muted"] = True
                    await send_json_safe(target["websocket"], {"type": "mute_participant", "target_id": target_id})
                    await broadcast_active(meeting_id, {
                        "type": "participant_state",
                        "participant_id": target_id,
                        "muted": True,
                    })
                continue

            # Normal WebRTC/chat/hand signalling.
            if target_id:
                target = next((x for x in room["active"] if x["participant_id"] == target_id), None)
                if target:
                    await send_json_safe(target["websocket"], message)
            else:
                await broadcast_active(meeting_id, message, exclude=participant_id)

    except WebSocketDisconnect:
        pass
    except Exception as error:
        print("WebSocket error:", error)
    finally:
        room = meeting_rooms.get(meeting_id)
        if room:
            if active_participant:
                room["active"] = [x for x in room["active"] if x["participant_id"] != active_participant["participant_id"]]
                await broadcast_active(meeting_id, {
                    "type": "user_left",
                    "participant_id": active_participant["participant_id"],
                    "user_id": active_participant["user_id"],
                    "name": active_participant["name"],
                    "is_host": active_participant["is_host"],
                    "participants": len(room["active"]),
                })
            if waiting_participant:
                room["waiting"] = [x for x in room["waiting"] if x["participant_id"] != waiting_participant["participant_id"]]
            if not room["active"] and not room["waiting"]:
                meeting_rooms.pop(meeting_id, None)


@app.get("/")
def home():
    return {"message": "PROJECT-X Backend is running 🚀", "version": "2.0"}


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


@app.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = User(name=data.name, email=data.email, password=hash_password(data.password))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Account created successfully", "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email}}


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"user_id": user.id, "email": user.email})
    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email}
    }


def get_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


@app.get("/me")
def get_current_user(user_id: int = Depends(get_user_id), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User is logged in", "user": {"id": user.id, "name": user.name, "email": user.email}}


@app.post("/meetings")
def create_meeting(user_id: int = Depends(get_user_id), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    while True:
        meeting_id = f"{random.randint(100,999)} {random.randint(100,999)} {random.randint(100,999)}"
        if not db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first():
            break
    new_meeting = Meeting(meeting_id=meeting_id, host_id=user.id)
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)
    return {"message": "Meeting created successfully", "meeting": {"id": new_meeting.id, "meeting_id": new_meeting.meeting_id, "host_id": new_meeting.host_id, "created_at": new_meeting.created_at}}


class JoinMeetingRequest(BaseModel):
    meeting_id: str


@app.post("/meetings/join")
def join_meeting(data: JoinMeetingRequest, user_id: int = Depends(get_user_id), db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.meeting_id == data.meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"message": "Join request accepted", "meeting": {"meeting_id": meeting.meeting_id, "host_id": meeting.host_id, "joined_user_id": user_id, "waiting_room": True}}
