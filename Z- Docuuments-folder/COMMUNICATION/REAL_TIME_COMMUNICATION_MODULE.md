# Digi Era Pro CRM Real-Time Communication Module
## Performance Benchmarks & Monitoring Guidelines

---

## 1. Socket.io Performance Benchmarks

### Message Throughput
- **Text Message**: 50-100ms delivery latency (P95), <2ms server processing
- **File Message**: 200-500ms (depends on file size and S3 upload)
- **Target Concurrent Users**: 50+ simultaneous connections per server instance
- **Message Rate Limit**: 10 messages/user/second (burst), 2 msg/sec sustained

### Connection Management
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Socket.io Connect Time | <500ms | >1s |
| Reconnection Time | <1s | >3s |
| Heartbeat Interval | 25s | N/A |
| Ping/Pong Timeout | 60s | N/A |
| Max Connections/Instance | 500 | >450 |

### Memory Per Connection
- **Per Active Socket**: ~2-3MB (baseline)
- **Per User with Message Buffer**: +1-2MB
- **Total for 50 Users**: ~150-250MB instance memory
- **Recommendation**: Node.js instance with 1GB+ RAM

---

## 2. WebRTC Call Benchmarks

### Voice Calls
- **Connection Establishment**: <2s (P95)
- **Audio Latency**: <150ms (E2E acceptable range)
- **Bandwidth Usage**: 30-100 kbps (depends on codec, network)
- **CPU Usage (per peer)**: 5-15% single core
- **Max Group Participants**: 6-10 (mesh topology) before quality degrades

### Video Calls
- **Connection Establishment**: <3s (P95)
- **Video Latency**: <200ms acceptable
- **Bandwidth HD (720p)**: 1.5-3 Mbps
- **Bandwidth SD (360p)**: 500-1000 kbps
- **CPU Usage (per peer)**: 25-40% single core
- **Max Group Video**: 4 participants (mesh), 20+ (SFU with server relay)

### Call Quality Metrics
```
Quality Score = (MOS - 1) × 25 where:
- MOS 4.0-5.0 = Excellent (Target: >4.2)
- MOS 3.5-4.0 = Good
- MOS <3.0 = Poor (Alert)

Monitored via:
- jitter <50ms (target)
- packet loss <1% (target)
- round-trip time <100ms (target)
```

---

## 3. File Operations Benchmarks

### AWS S3 Upload Performance
| File Type | Size Range | Upload Time (P95) | Bandwidth |
|-----------|------------|-------------------|-----------|
| Images (JPEG/PNG) | 1-10MB | <5s | 2 Mbps |
| Documents (PDF) | 1-50MB | <15s | 3+ Mbps |
| Video | 10-100MB | <30s | 3+ Mbps |
| Voice Messages | 100KB-5MB | <2s | 1 Mbps |

### File Processing
- **Image Thumbnail Generation**: <500ms (via Sharp)
- **S3 Presigned URL Generation**: <100ms
- **Virus Scan (optional)**: <5s (queued async)
- **File Validation**: <50ms (type + size check)

### Storage Optimization
- **Image Auto-Compression**: JPEG 80% quality (70-80% size reduction)
- **Thumbnail Size**: 150px max dimension (~20-50KB)
- **Lifecycle Policy**: Archive after 90 days, delete after 1 year

---

## 4. Database Performance Benchmarks (MongoDB)

### Query Performance Targets
| Query Type | Target Latency | Alert Threshold |
|-----------|----------------|-----------------|
| Fetch Message History | <100ms | >500ms |
| Search Messages (full-text) | <200ms | >1s |
| Channel List | <50ms | >200ms |
| Presence Update | <50ms | >200ms |
| Call History | <100ms | >500ms |

### Index Strategy
```javascript
// Critical Indexes (Create These)
- Communication: { channelId: 1, createdAt: -1 }
- Communication: { message: 'text' } (full-text search)
- Channel: { 'participants.userId': 1 }
- Channel: { channelType: 1, isArchived: 1 }
- CallHistory: { channelId: 1, startedAt: -1 }
- Presence: { userId: 1, status: 1 }

// Count: 12-15 indexes per collection
```

### Database Load Estimation (50 Concurrent Users)

**Daily Operations**
- Messages Created: 2,000-5,000 (40 msg/user/day average)
- Files Uploaded: 100-200 (2-4 per user)
- Calls Recorded: 30-50 (0.6-1 per user)
- Presence Updates: 50,000+ (1000 per user, includes heartbeat)

**Storage Growth**
```
Messages: ~1KB per message
  → 50 users × 40 msg × 365 days = 730,000 msg/year
  → ~730MB/year (uncompressed)

Files Metadata: ~500B per attachment
  → 150 files × 365 days = 54,750 files/year
  → ~25MB/year (metadata only; S3 holds actual files)

Call History: ~2KB per call record
  → 50 users × 250 calls/year = 12,500 calls
  → ~25MB/year

Total: ~750-800MB/year
```

**MongoDB Atlas Cost Impact (M10+ Cluster)**
- **Base M10**: $58/month, 10GB storage included
- **Each 10GB**: +$58/month
- **Projection**: $58-116/month for 50 users annually
- **Backup**: +$0.50 per GB snapshots

---

## 5. Network & Infrastructure Benchmarks

### Bandwidth Usage (Per User, Peak Hour)
- **Text Chat Only**: 50-100 kbps
- **File Sharing Active**: 500 kbps - 2 Mbps
- **Voice Call**: 30-100 kbps
- **Video Call (HD)**: 1.5-3 Mbps
- **All Features Active**: 2-5 Mbps

### Server Infrastructure (50 Users)
```
Recommended Setup:
- Node.js API Server: 2vCPU, 2GB RAM (handles Socket.io + API)
- Redis Instance: 1vCPU, 1GB RAM (session + adapter)
- MongoDB: Shared atlas M10 or higher
- AWS S3: Unlimited (cost per usage)

Monthly Estimate (AWS + Vercel):
- Compute (Vercel): $20-50
- Database (Atlas M10): $58
- S3 (1000+ files): $10-20
- Bandwidth (CDN): $5-15
- Total: ~$100-150/month
```

---

## 6. Real-Time Response Benchmarks

### Critical User-Facing Latencies
| Action | P50 (ms) | P95 (ms) | P99 (ms) |
|--------|----------|----------|----------|
| Send Text Message | 30 | 100 | 300 |
| Receive Message | 50 | 150 | 400 |
| Typing Indicator | 20 | 50 | 100 |
| File Upload Complete | 2000 | 5000 | 10000 |
| Call Connect | 1000 | 2000 | 5000 |
| Message Search | 150 | 300 | 1000 |

---

## 7. Scalability Benchmarks

### Horizontal Scaling (Per Instance)

**Single Instance Capacity**
- Max Concurrent WebSockets: 500
- Max Active Calls: 20 (group calls) to 100+ (1:1 calls)
- Max Channels: Unlimited (database limited)
- Recommended User Load: 50-100 concurrent

**Multi-Instance Setup (With Redis Adapter)**
- Instances: 2-3 for redundancy
- Load Balancer: Sticky sessions (Socket.io room affinity)
- Redis: Shared cluster (handles pub/sub across instances)
- Database: Single MongoDB cluster (handles all instances)

**Scaling Decision Points**
- At 100 concurrent users: Add 2nd Node instance
- At 250 concurrent users: Add 3rd instance + SFU server for video calls
- At 500+ users: Implement WebRTC SFU (Selective Forwarding Unit) for efficiency

---

## 8. Monitoring Metrics Dashboard

### Key Performance Indicators (KPIs)
```
Real-Time (Updated Every 10s)
- Connected Sockets: 0-500
- Active Channels: Total count
- Messages/Min: Current rate
- Avg Message Latency: P95 value
- WebSocket CPU Usage: %
- Memory Used: MB

Hourly Aggregates
- Peak Concurrent Users: Max during hour
- Total Messages Sent: Sum
- Total Calls: Count + avg duration
- Failed Messages: Count + %
- Disconnects/Reconnects: Count

Daily Reports
- DAU (Daily Active Users)
- Most Active Channels
- Call Quality Score (avg MOS)
- Storage Used (S3 + DB)
- Infrastructure Cost
```

### Alert Thresholds
```yaml
Critical (Immediate Action)
  - Socket connect time > 2s
  - Message latency P95 > 1s
  - CPU usage > 90%
  - Memory > 85% of limit
  - MongoDB connection pool exhausted
  - Redis unavailable

Warning (Review)
  - Socket connect time > 1s
  - Message latency P95 > 500ms
  - CPU usage > 70%
  - Failed message rate > 2%
  - Call connection time > 5s
  - Database query > 500ms
```

---

## 9. Database Cost Breakdown (MongoDB Atlas)

### Tier Selection for 50 Users

**Recommended: M10 Cluster**
- **Cost**: $58/month
- **Storage**: 10GB included
- **RAM**: 2GB
- **Automatic backups**: Included
- **Replication**: 3-node replica set

**Projected Annual Growth**
```
Year 1: M10 ($58/mo) = $696/year
Year 2: M10-M20 ($116/mo) = $1,392/year
Year 3: M20+ ($200/mo+) = $2,400+/year
```

**Optimization Strategies**
1. Archive old messages (>6 months) to cheaper storage
2. Enable compression on MongoDB collections
3. Implement aggressive indexing
4. Use TTL indexes for temporary data (presence, typing status)
5. Regular cleanup of deleted messages (soft deletes)

---

## 10. Deployment Configuration

### Environment Variables
```env
# Socket.io
SOCKET_IO_PATH=/api/socket/io
MAX_HTTP_BUFFER_SIZE=52428800 # 50MB
SOCKET_HEARTBEAT=25000
SOCKET_TIMEOUT=60000

# Redis (for adapter)
REDIS_URL=redis://[...]:6379

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/deplc-chat

# AWS S3
AWS_REGION=us-east-1
AWS_S3_BUCKET=deplc-crm-chat
AWS_S3_MAX_FILE_SIZE=52428800

# Features
ENABLE_CALL_RECORDING=true
ENABLE_MESSAGE_SEARCH=true
VOICE_MESSAGE_MAX_DURATION=300
CALL_MAX_PARTICIPANTS=50
```

### Health Check Endpoints
```
GET /api/health
- Database connection
- Redis connection
- S3 connectivity
- Overall status (UP/DEGRADED/DOWN)

Response Time: <100ms
Frequency: Every 30s (monitoring)
```

---

## 11. Performance Optimization Checklist

### Immediate (Week 1)
- [ ] Enable Socket.io Redis adapter
- [ ] Create all recommended database indexes
- [ ] Implement message pagination (50 msg/page)
- [ ] Set up CloudFront CDN for S3 files
- [ ] Configure S3 file expiration (90 day archive)

### Short-Term (Month 1)
- [ ] Implement call recording with compression
- [ ] Add full-text search caching layer
- [ ] Set up monitoring dashboard (Datadog/New Relic)
- [ ] Implement message rate limiting
- [ ] Add WebRTC TURN server configuration

### Medium-Term (Quarter 1)
- [ ] Implement message archive (>90 days)
- [ ] Deploy SFU server for video calls (optional, if >4 users/call)
- [ ] Add analytics for usage patterns
- [ ] Optimize image compression pipeline
- [ ] Implement offline message queue (IndexedDB)

### Long-Term (Year 1+)
- [ ] Multi-region failover setup
- [ ] Advanced call quality monitoring
- [ ] Machine learning for spam detection
- [ ] Custom search engine (Elasticsearch)
- [ ] GraphQL subscription layer

---

## 12. Mermaid Architecture Diagram

```mermaid
graph TB
    Client["Client Browser<br/>(React/Next.js)"]
    LB["Load Balancer<br/>(Sticky Sessions)"]
    
    subgraph "Node.js Cluster"
        API1["API Server 1<br/>(Socket.io + REST)"]
        API2["API Server 2<br/>(Socket.io + REST)"]
        API3["API Server 3<br/>(Optional)"]
    end
    
    Redis["Redis Cluster<br/>(Socket.io Adapter<br/>+ Cache)"]
    MongoDB["MongoDB Atlas<br/>(M10+ Cluster)"]
    S3["AWS S3<br/>(File Storage)"]
    CloudFront["CloudFront CDN<br/>(S3 Cache)"]
    TURN["TURN Server<br/>(WebRTC Relay)"]
    
    Client -->|ws + http| LB
    LB -->|sticky| API1
    LB -->|sticky| API2
    LB -->|sticky| API3
    
    API1 -->|pub/sub| Redis
    API2 -->|pub/sub| Redis
    API3 -->|pub/sub| Redis
    
    Redis -->|cache| API1
    Redis -->|cache| API2
    Redis -->|cache| API3
    
    API1 -->|read/write| MongoDB
    API2 -->|read/write| MongoDB
    API3 -->|read/write| MongoDB
    
    API1 -->|upload/download| S3
    API2 -->|upload/download| S3
    Client -->|cdn| CloudFront
    CloudFront -->|cache| S3
    
    Client -->|webrtc signaling| API1
    Client -->|webrtc media| TURN
    
    style Client fill:#e1f5ff
    style LB fill:#fff3e0
    style API1 fill:#f3e5f5
    style API2 fill:#f3e5f5
    style API3 fill:#f3e5f5
    style Redis fill:#e8f5e9
    style MongoDB fill:#fce4ec
    style S3 fill:#fff9c4
    style CloudFront fill:#fff9c4
    style TURN fill:#ede7f6
```

---

## 13. Cost Projection Summary (Annual)

| Component | Monthly | Annual | Notes |
|-----------|---------|--------|-------|
| **Compute** |  |  |  |
| Vercel (Node.js) | $50 | $600 | 2-3 instances, auto-scaling |
| **Database** |  |  |  |
| MongoDB Atlas M10 | $58 | $696 | 10GB storage, grows to M20 at Year 2 |
| **Storage & CDN** |  |  |  |
| AWS S3 | $15 | $180 | ~1000 files, standard storage |
| CloudFront | $10 | $120 | Cache hits for S3 files |
| **Networking** |  |  |  |
| VPC/Private Link | $5 | $60 | Inter-service communication |
| **Monitoring** |  |  |  |
| Datadog/New Relic | $20 | $240 | Basic plan for 50 users |
| **Misc** |  |  |  |
| TURN Server | $10 | $120 | WebRTC relay (metered) |
| **TOTAL** | **$168** | **$2,016** | For 50 concurrent users |

---

## Conclusion



This benchmark framework provides measurable targets for monitoring and optimizing the Digi Era Pro CRM real-time communication module at scale. Start with the "Immediate" optimization checklist, then scale incrementally as usage grows. The projected infrastructure cost of ~$2K/year is highly economical for 50+ concurrent users with production-grade reliability.


Real-Time Communication Module Implementation Guide for Digi Era Pro CRM
This comprehensive guide documents the implementation of an advanced real-time communication module for the Digi Era Pro CRM system built with Next.js. The module enables bidirectional, real-time messaging with multimedia support including text, files, voice messages, voice/video calls between internal users, with sophisticated channel management and security.
📋 Table of Contents

Overview
Technology Stack
Architecture Overview
Feature Set
File Structure
Database Layer
Validation Layer
API Layer
Real-Time Communication (Socket.io)
WebRTC Implementation
State Management
Frontend Implementation
File Handling with AWS S3
Voice Messages
Channel Types & Management
Security & Permissions
Advanced Features
UI/UX Design
Testing Strategy
Deployment
Implementation Checklist


🚀 Overview
The communication module provides a comprehensive chat system with:

Real-time text messaging with Socket.io
Voice and video calling with WebRTC
File sharing via AWS S3 (documents, images, videos)
Voice messages with audio recording
Multiple channel types (DM, General, Project, Department)
Professional UI/UX following existing CRM patterns
Client exclusion from internal communications
Advanced features (message threading, reactions, search, pinning)
Offline support with message queuing
End-to-end encryption for sensitive communications

Key Differentiators from Previous Version
✅ WebRTC integration for voice/video calls
✅ Voice message recording and playback
✅ Department-based channels for team communication
✅ General company-wide channel (excluding clients)
✅ Advanced file handling with previews and thumbnails
✅ Message reactions and threading (Slack-like)
✅ Call recording and history
✅ Screen sharing support
✅ Advanced presence system (online, away, DND, offline)
✅ Message search with full-text indexing
✅ Channel archiving and management

🛠️ Technology Stack
Core Technologies
Socket.io (Real-Time Events)
Why Socket.io?

✅ Bidirectional event-based communication
✅ Automatic reconnection with exponential backoff
✅ Room/namespace support for channel management
✅ Binary streaming for file transfers
✅ Redis adapter for horizontal scaling
✅ Native TypeScript support
✅ Middleware for authentication and authorization

Installation:
bashnpm install socket.io socket.io-client
npm install @socket.io/redis-adapter redis
WebRTC (Voice/Video Calls)
Why WebRTC?

✅ Peer-to-peer communication (low latency)
✅ Native browser support (no plugins)
✅ Screen sharing capabilities
✅ Adaptive bitrate for network conditions
✅ End-to-end encryption by default
✅ Media stream recording

Libraries:
bashnpm install simple-peer
npm install recordrtc
npm install @mediapipe/hands # For background blur (optional)
AWS S3 (File Storage)
Why AWS S3?

✅ Unlimited scalable storage
✅ Presigned URLs for secure uploads
✅ Lifecycle policies for cost optimization
✅ CloudFront CDN integration
✅ Server-side encryption (SSE-S3)
✅ Versioning for file history

Installation:
bashnpm install @aws-sdk/client-s3
npm install @aws-sdk/s3-request-presigner
npm install sharp # For image optimization
Additional Dependencies
bash# Audio processing
npm install lamejs # MP3 encoding
npm install opus-encoder # Opus codec for voice messages

# Search
npm install @mongodb-js/fuzzy-search # Full-text search

# Notifications
npm install web-push # Push notifications

# Security
npm install helmet # Security headers
npm install rate-limiter-flexible # Rate limiting

# Utils
npm install dayjs # Date manipulation
npm install file-type # File type detection
npm install sanitize-html # HTML sanitization

🏗️ Architecture Overview
The module extends the existing CRM architecture with real-time layers:
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/Next.js)                 │
├─────────────────────────────────────────────────────────────┤
│ • UI Components (Chat Window, Call Interface)                │
│ • Custom Hooks (useCommunication, useWebRTC)                 │
│ • State Management (Redux Toolkit)                           │
│ • Socket.io Client (Events: message, typing, call)           │
│ • WebRTC Manager (Peer connections, media streams)           │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              API Layer (Next.js API Routes)                  │
├─────────────────────────────────────────────────────────────┤
│ • Socket.io Server (/api/socket)                             │
│   - Authentication middleware                                │
│   - Room management                                          │
│   - Event handlers (message, call, presence)                 │
│ • WebRTC Signaling Server                                    │
│   - SDP offer/answer exchange                                │
│   - ICE candidate exchange                                   │
│ • REST Endpoints (/api/communications)                       │
│   - Message history (GET)                                    │
│   - Channel CRUD (GET/POST/PUT/DELETE)                       │
│   - File upload (POST with presigned URLs)                   │
│ • Middleware (genericApiRoutesMiddleware)                    │
│ • Validation (Zod schemas)                                   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Layer (MongoDB/Mongoose)               │
├─────────────────────────────────────────────────────────────┤
│ • Communication Model (messages, channels)                   │
│ • Channel Model (metadata, participants)                     │
│ • CallHistory Model (call records)                           │
│ • Presence Model (user online status)                        │
│ • Indexes for performance (channelId, senderId, timestamps)  │
│ • Full-text search index (message content)                   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
├─────────────────────────────────────────────────────────────┤
│ • AWS S3 (file storage)                                      │
│ • Redis (Socket.io adapter, caching, presence)               │
│ • TURN/STUN Servers (WebRTC relay)                           │
│ • CloudFront (CDN for files)                                 │
│ • Web Push API (notifications)                               │
└─────────────────────────────────────────────────────────────┘
Data Flow Examples
1. Text Message Flow
User A → Input Message → Validate (Zod) → Socket.io Emit 'sendMessage'
                                              ↓
                            Socket.io Server receives event
                                              ↓
                            Authenticate & Authorize (Middleware)
                                              ↓
                            Persist to MongoDB (Communication Model)
                                              ↓
                            Broadcast to room (Socket.io rooms)
                                              ↓
                            User B receives 'newMessage' event
                                              ↓
                            Redux updates state → UI re-renders
2. Voice/Video Call Flow
User A initiates call → Socket.io emit 'callRequest' → Server notifies User B
                                                             ↓
                            User B accepts → 'callAccepted' event
                                                             ↓
                            WebRTC SDP exchange via Socket.io
                            (offer/answer + ICE candidates)
                                                             ↓
                            Peer-to-peer connection established
                                                             ↓
                            Media streams exchanged directly (WebRTC)
                            (Server only handles signaling, not media)
3. File Upload Flow
User selects file → Request presigned URL (GET /api/communications/upload-url)
                                              ↓
                            Server validates (size, type)
                                              ↓
                            Generate presigned URL (AWS S3)
                                              ↓
                            Frontend uploads directly to S3
                                              ↓
                            Send message with S3 URL (Socket.io 'sendMessage')
                                              ↓
                            Server persists message with attachment metadata
                                              ↓
                            Broadcast to room with file preview

🎯 Feature Set
1. Text Communication

✅ Real-time messaging with typing indicators
✅ Message formatting (bold, italic, code blocks, links)
✅ Mentions (@user) with notifications
✅ Emoji reactions (👍, ❤️, 😂, etc.)
✅ Message threading (replies with parent context)
✅ Message editing and deletion (with history)
✅ Read receipts (individual and group)
✅ Message pinning for important updates
✅ Full-text search with highlighting
✅ Link previews (Open Graph metadata)
✅ Code syntax highlighting for developers
✅ Message scheduling (send later)

2. File Sharing

✅ Multiple file types (images, videos, documents, audio)
✅ Drag-and-drop upload with progress indicators
✅ Image previews and thumbnails (auto-generated)
✅ Video previews with playback controls
✅ Document viewers (PDF inline preview)
✅ File size limits (configurable, default 50MB)
✅ Virus scanning integration (AWS Macie/ClamAV)
✅ File compression (images auto-optimized)
✅ Shared file gallery per channel
✅ File expiration (auto-delete after X days)

3. Voice Messages

✅ Audio recording (browser MediaRecorder API)
✅ Waveform visualization during recording
✅ Playback controls (play, pause, speed, scrub)
✅ Duration limits (default 5 minutes)
✅ Format conversion (WebM → MP3 via FFmpeg/lamejs)
✅ Storage in S3 with presigned playback URLs
✅ Transcription (optional, AWS Transcribe integration)

4. Voice Calls

✅ One-on-one calls (WebRTC peer-to-peer)
✅ Group calls (up to 50 participants, mesh/SFU topology)
✅ Call quality indicators (network stats)
✅ Mute/unmute controls
✅ Speaker selection (input/output devices)
✅ Noise suppression (WebRTC audio processing)
✅ Call recording (with consent, stored in S3)
✅ Call history with duration and participants
✅ Missed call notifications
✅ Callback buttons for missed calls

5. Video Calls

✅ One-on-one video (HD quality, adaptive bitrate)
✅ Group video (gallery and speaker views)
✅ Screen sharing (entire screen or window)
✅ Virtual backgrounds (MediaPipe or canvas blur)
✅ Camera controls (on/off, switch front/back)
✅ Whiteboard integration (collaborative canvas)
✅ Picture-in-picture mode
✅ Video recording with layout options
✅ Bandwidth optimization (simulcast, SVC)

6. Channel Types
User-to-User (DM)

Private 1:1 conversations
Cannot be deleted, only archived
Always accessible to both participants
No third-party access (except admins with audit logs)

General Channel

Company-wide communication for all internal users
Excludes clients (isInternal: true enforced)
Announcements section (pinned messages)
Read-only mode (optional, for leadership updates)
Moderation tools (delete, mute users)

Project-Based Channels

Automatically created with new projects
Participants: Project team members (from PROJECTS.assigned_to)
Context integration: Link to project details, tasks, milestones
File sharing: Auto-link to project documents
Archived when project completes (soft delete)

Department-Based Channels

Created per department (e.g., "Engineering", "Sales")
Participants: Users with matching USERS.department
Auto-join: New users added automatically
Department leads as moderators (USERS.role === 'manager')
Cross-department channels (optional, for collaboration)

7. Advanced Features
Presence System

Statuses: Online, Away, Do Not Disturb, Offline
Auto-away: After 5 minutes of inactivity
Custom status messages (e.g., "In a meeting")
Last seen timestamps (privacy-respecting)

Message Search

Full-text search across messages (MongoDB text index)
Filters: By channel, sender, date range, file type
Search highlights in results
Search suggestions (autocomplete)

Notifications

Push notifications (Web Push API for desktop/mobile)
Email digests for missed messages (configurable frequency)
Sound alerts (customizable per channel)
Notification preferences: Per channel (mute, @mentions only, all)
Badge counts on channels and app icon

Offline Support

Message queue: Store unsent messages locally (IndexedDB)
Auto-retry: Resend on reconnection
Conflict resolution: Merge offline changes
Offline indicators: Visual cues for network status

Moderation & Safety

Profanity filter (configurable word list)
Spam detection (rate limiting per user)
Report message feature (flags for admin review)
User blocking (mute specific users)
Audit logs: All actions logged (AUDIT_LOGS model)


📁 File Structure
Updated structure with new real-time components:
📦 Digi Era Pro CRM
├─ 📁 models/
│  ├─ Communication.ts              # Enhanced message model
│  ├─ Channel.ts                    # New: Channel metadata model
│  ├─ CallHistory.ts                # New: Call records
│  ├─ Presence.ts                   # New: User presence
│  └─ Reaction.ts                   # New: Message reactions
│
├─ 📁 lib/
│  ├─ 📁 validations/
│  │  ├─ communication.ts           # Enhanced Zod schemas
│  │  ├─ channel.ts                 # Channel validation
│  │  └─ call.ts                    # Call validation
│  ├─ 📁 socket/
│  │  ├─ server.ts                  # Socket.io server setup
│  │  ├─ handlers/
│  │  │  ├─ message.ts              # Message event handlers
│  │  │  ├─ call.ts                 # Call signaling handlers
│  │  │  ├─ presence.ts             # Presence handlers
│  │  │  └─ typing.ts               # Typing indicator handlers
│  │  └─ middleware.ts              # Socket middleware (auth, permissions)
│  ├─ 📁 webrtc/
│  │  ├─ signaling.ts               # WebRTC signaling logic
│  │  ├─ peer-manager.ts            # Manage peer connections
│  │  └─ media-utils.ts             # Media stream helpers
│  ├─ aws-s3.ts                     # Enhanced S3 utilities
│  ├─ redis.ts                      # Redis client for Socket.io adapter
│  └─ voice-processing.ts           # Voice message encoding/decoding
│
├─ 📁 app/api/
│  ├─ 📁 socket/
│  │  └─ route.ts                   # Socket.io initialization endpoint
│  ├─ 📁 communications/
│  │  ├─ route.ts                   # GET (messages), POST (send)
│  │  ├─ [id]/
│  │  │  └─ route.ts                # GET/PUT/DELETE single message
│  │  ├─ upload-url/
│  │  │  └─ route.ts                # Generate presigned S3 URLs
│  │  ├─ search/
│  │  │  └─ route.ts                # Full-text search
│  │  └─ reactions/
│  │     └─ route.ts                # Add/remove reactions
│  ├─ 📁 channels/
│  │  ├─ route.ts                   # GET (list), POST (create)
│  │  ├─ [id]/
│  │  │  ├─ route.ts                # GET/PUT/DELETE channel
│  │  │  ├─ participants/
│  │  │  │  └─ route.ts             # Manage participants
│  │  │  └─ pins/
│  │  │     └─ route.ts             # Pin/unpin messages
│  │  └─ general/
│  │     └─ route.ts                # Special: General channel access
│  └─ 📁 calls/
│     ├─ route.ts                   # GET call history
│     ├─ [id]/
│     │  └─ route.ts                # GET call details
│     └─ recordings/
│        └─ route.ts                # Access recordings
│
├─ 📁 store/slices/
│  ├─ communicationSlice.ts         # Enhanced Redux slice
│  ├─ channelSlice.ts               # Channel state
│  ├─ callSlice.ts                  # Call state (active calls, history)
│  └─ presenceSlice.ts              # User presence state
│
├─ 📁 hooks/
│  ├─ use-communication.ts          # Enhanced chat operations
│  ├─ use-channel.ts                # Channel management
│  ├─ use-webrtc.ts                 # WebRTC peer connections
│  ├─ use-voice-recorder.ts         # Voice message recording
│  ├─ use-file-upload.ts            # File upload with progress
│  └─ use-presence.ts               # User presence tracking
│
├─ 📁 components/ui/
│  ├─ 📁 chat/
│  │  ├─ chat-window.tsx            # Enhanced main chat interface
│  │  ├─ channel-list.tsx           # Enhanced sidebar with filters
│  │  ├─ message-list.tsx           # Enhanced with reactions, threading
│  │  ├─ message-input.tsx          # Enhanced with voice, files
│  │  ├─ message-item.tsx           # New: Individual message component
│  │  ├─ context-panel.tsx          # Enhanced with call history
│  │  ├─ channel-header.tsx         # New: Header with call buttons
│  │  ├─ typing-indicator.tsx       # Typing animation component
│  │  └─ thread-view.tsx            # New: Message thread sidebar
│  ├─ 📁 call/
│  │  ├─ call-window.tsx            # New: Video call interface
│  │  ├─ call-controls.tsx          # New: Mute, camera, screen share
│  │  ├─ participant-grid.tsx       # New: Video grid layout
│  │  ├─ call-notification.tsx      # New: Incoming call modal
│  │  └─ call-history.tsx           # New: Call log component
│  ├─ 📁 voice/
│  │  ├─ voice-recorder.tsx         # New: Recording interface
│  │  ├─ voice-message.tsx          # New: Playback component
│  │  └─ waveform.tsx               # New: Audio waveform visualization
│  ├─ 📁 files/
│  │  ├─ file-upload.tsx            # New: Upload widget with drag-drop
│  │  ├─ file-preview.tsx           # New: Preview images/videos/PDFs
│  │  ├─ file-gallery.tsx           # New: Channel file browser
│  │  └─ file-progress.tsx          # New: Upload progress bar
│  ├─ online-indicator.tsx          # Enhanced with status options
│  ├─ presence-badge.tsx            # New: User status badge
│  ├─ reaction-picker.tsx           # New: Emoji reaction selector
│  └─ message-notification.tsx      # Enhanced notification system
│
├─ 📁 app/
│  ├─ 📁 communications/
│  │  ├─ page.tsx                   # Enhanced main dashboard
│  │  ├─ [channelId]/
│  │  │  └─ page.tsx                # Enhanced channel page
│  │  ├─ general/
│  │  │  └─ page.tsx                # New: General channel page
│  │  └─ calls/
│  │     └─ page.tsx                # New: Call history page
│  └─ 📁 client-portal/
│     └─ chat/
│        └─ page.tsx                # Restricted (no access to new features)
│
└─ 📁 types/
   ├─ communication.ts              # Enhanced interfaces
   ├─ channel.ts                    # Channel types
   ├─ call.ts                       # Call types
   └─ webrtc.ts                     # WebRTC types

💾 Database Layer
1. Enhanced Communication Model
File: models/Communication.ts
typescriptimport mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAttachment {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string; // For images/videos
  duration?: number; // For audio/video (in seconds)
}

export interface IReaction {
  emoji: string;
  userId: Types.ObjectId;
  createdAt: Date;
}

export interface ICommunication extends Document {
  // References
  channelId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderModel: 'User' | 'Client';
  
  // Message content
  message: string;
  messageType: 'text' | 'file' | 'voice' | 'system'; // System for join/leave messages
  attachments: IAttachment[];
  
  // Threading
  parentMessageId?: Types.ObjectId;
  threadCount: number; // Number of replies
  
  // Interactions
  reactions: IReaction[];
  isPinned: boolean;
  pinnedBy?: Types.ObjectId;
  pinnedAt?: Date;
  
  // Status
  isRead: boolean;
  readBy: Types.ObjectId[]; // For group channels
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  
  // Metadata
  mentions: Types.ObjectId[]; // @user mentions
  linkPreview?: {
    url: string;
    title: string;
    description: string;
    image: string;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>({
  url: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  thumbnailUrl: { type: String },
  duration: { type: Number }, // For audio/video
}, { _id: false });

const ReactionSchema = new Schema<IReaction>({
  emoji: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const CommunicationSchema = new Schema<ICommunication>({
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, refPath: 'senderModel', required: true },
  senderModel: { type: String, enum: ['User', 'Client'], required: true },
  
  message: { type: String, required: true, trim: true },
  messageType: { type: String, enum: ['text', 'file', 'voice', 'system'], default: 'text' },
  attachments: [AttachmentSchema],
  
  parentMessageId: { type: Schema.Types.ObjectId, ref: 'Communication', index: true },
  threadCount: { type: Number, default: 0 },
  
  reactions: [ReactionSchema],
  isPinned: { type: Boolean, default: false, index: true },
  pinnedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  pinnedAt: { type: Date },
  
  isRead: { type: Boolean, default: false },
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  linkPreview: {
    url: String,
    title: String,
    description: String,
    image: String,
  },
}, { timestamps: true });

// Indexes for performance
CommunicationSchema.index({ channelId: 1, createdAt: -1 }); // Message history
CommunicationSchema.index({ channelId: 1, isPinned: 1, createdAt: -1 }); // Pinned messages
CommunicationSchema.index({ parentMessageId: 1, createdAt: 1 }); // Thread replies
CommunicationSchema.index({ senderId: 1, createdAt: -1 }); // User messages
CommunicationSchema.index({ mentions: 1, isRead: 1 }); // Unread mentions
CommunicationSchema.index({ message: 'text' }); // Full-text search

// Virtual for thread replies
CommunicationSchema.virtual('replies', {
  ref: 'Communication',
  localField: '_id',
  foreignField: 'parentMessageId',
});

// Middleware: Increment thread count on parent
CommunicationSchema.pre('save', async function(next) {
  if (this.isNew && this.parentMessageId) {
    await mongoose.model('Communication').findByIdAndUpdate(
      this.parentMessageId,
      { $inc: { threadCount: 1 } }
    );
  }
  next();
});

// Methods
CommunicationSchema.methods.addReaction = async function(emoji: string, userId: Types.ObjectId) {
  const existingIndex = this.reactions.findIndex(
    r => r.emoji === emoji && r.userId.equals(userId)
  );
  
  if (existingIndex !== -1) {
    this.reactions.splice(existingIndex, 1); // Remove if already reacted
  } else {
    this.reactions.push({ emoji, userId, createdAt: new Date() });
  }
  
  return this.save();
};

export default mongoose.models.Communication || 
  mongoose.model<ICommunication>('Communication', CommunicationSchema);
2. Channel Model (New)
File: models/Channel.ts
typescriptimport mongoose, { Document, Schema, Types } from 'mongoose';

export interface IParticipant {
  userId: Types.ObjectId;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  lastReadAt?: Date;
  notificationPreference: 'all' | 'mentions' | 'none';
}

export interface IChannel extends Document {
  name: string;
  description?: string;
  channelType: 'dm' | 'general' | 'project' | 'department';
  
  // Participants
  participants: IParticipant[];
  
  // Access control
  is_private: boolean;
  isInternal: boolean; // Exclude clients
  
  // Related entities
  projectId?: Types.ObjectId;
  departmentId?: string; // Department name from USERS
  
  // Settings
  isArchived: boolean;
  archivedAt?: Date;
  isReadOnly: boolean; // For announcements
  
  // Statistics
  messageCount: number;
  lastMessageAt?: Date;
  
  // Metadata
  avatar?: string; // Channel avatar URL
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now },
  lastReadAt: { type: Date },
  notificationPreference: { 
    type: String, 
    enum: ['all', 'mentions', 'none'], 
    default: 'all' 
  },
}, { _id: false });

const ChannelSchema = new Schema<IChannel>({
  name: { type: String, required: true, trim: true, index: true },
  description: { type: String, trim: true },
  channelType: { 
    type: String, 
    enum: ['dm', 'general', 'project', 'department'], 
    required: true,
    index: true 
  },
  
  participants: [ParticipantSchema],
  
  is_private: { type: Boolean,RetryClaude does not have the ability to run the code it generates yet.AHContinuetypescript  is_private: { type: Boolean, default: false },
  isInternal: { type: Boolean, default: true, index: true },
  
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
  departmentId: { type: String, index: true },
  
  isArchived: { type: Boolean, default: false, index: true },
  archivedAt: { type: Date },
  isReadOnly: { type: Boolean, default: false },
  
  messageCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date },
  
  avatar: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Indexes
ChannelSchema.index({ channelType: 1, isArchived: 1 });
ChannelSchema.index({ 'participants.userId': 1 });
ChannelSchema.index({ projectId: 1, isArchived: 1 });
ChannelSchema.index({ departmentId: 1, isArchived: 1 });
ChannelSchema.index({ isInternal: 1, channelType: 1 });

// Unique constraint for DM channels (prevent duplicates)
ChannelSchema.index(
  { 
    channelType: 1, 
    'participants.userId': 1 
  },
  { 
    unique: true,
    partialFilterExpression: { channelType: 'dm' }
  }
);

// Validation: DM channels must have exactly 2 participants
ChannelSchema.pre('save', function(next) {
  if (this.channelType === 'dm' && this.participants.length !== 2) {
    return next(new Error('DM channels must have exactly 2 participants'));
  }
  
  if (this.channelType === 'general' && !this.isInternal) {
    return next(new Error('General channel must be internal only'));
  }
  
  next();
});

// Methods
ChannelSchema.methods.addParticipant = async function(
  userId: Types.ObjectId, 
  role: 'owner' | 'admin' | 'member' = 'member'
) {
  const exists = this.participants.some(p => p.userId.equals(userId));
  if (!exists) {
    this.participants.push({
      userId,
      role,
      joinedAt: new Date(),
      notificationPreference: 'all',
    });
    return this.save();
  }
  return this;
};

ChannelSchema.methods.removeParticipant = async function(userId: Types.ObjectId) {
  this.participants = this.participants.filter(p => !p.userId.equals(userId));
  return this.save();
};

ChannelSchema.methods.updateLastRead = async function(userId: Types.ObjectId) {
  const participant = this.participants.find(p => p.userId.equals(userId));
  if (participant) {
    participant.lastReadAt = new Date();
    return this.save();
  }
};

// Statics
ChannelSchema.statics.findOrCreateDM = async function(
  user1Id: Types.ObjectId, 
  user2Id: Types.ObjectId
) {
  const existingChannel = await this.findOne({
    channelType: 'dm',
    'participants.userId': { $all: [user1Id, user2Id] },
  });
  
  if (existingChannel) return existingChannel;
  
  return this.create({
    name: `DM-${user1Id}-${user2Id}`,
    channelType: 'dm',
    isInternal: true,
    participants: [
      { userId: user1Id, role: 'owner', joinedAt: new Date() },
      { userId: user2Id, role: 'owner', joinedAt: new Date() },
    ],
    createdBy: user1Id,
  });
};

export default mongoose.models.Channel || 
  mongoose.model<IChannel>('Channel', ChannelSchema);
3. CallHistory Model (New)
File: models/CallHistory.ts
typescriptimport mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICallParticipant {
  userId: Types.ObjectId;
  joinedAt: Date;
  leftAt?: Date;
  duration?: number; // In seconds
  isMuted?: boolean;
  hasVideo?: boolean;
}

export interface ICallHistory extends Document {
  channelId: Types.ObjectId;
  callType: 'voice' | 'video';
  initiatorId: Types.ObjectId;
  
  participants: ICallParticipant[];
  
  startedAt: Date;
  endedAt?: Date;
  totalDuration?: number; // In seconds
  
  callStatus: 'ongoing' | 'completed' | 'missed' | 'rejected' | 'failed';
  
  // Recording
  isRecorded: boolean;
  recordingUrl?: string;
  recordingDuration?: number;
  
  // WebRTC metrics
  avgQuality?: number; // 0-100 score
  networkIssues?: string[]; // e.g., ['packet-loss', 'jitter']
  
  createdAt: Date;
  updatedAt: Date;
}

const CallParticipantSchema = new Schema<ICallParticipant>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  joinedAt: { type: Date, required: true },
  leftAt: { type: Date },
  duration: { type: Number },
  isMuted: { type: Boolean, default: false },
  hasVideo: { type: Boolean, default: false },
}, { _id: false });

const CallHistorySchema = new Schema<ICallHistory>({
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  callType: { type: String, enum: ['voice', 'video'], required: true },
  initiatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  participants: [CallParticipantSchema],
  
  startedAt: { type: Date, required: true, default: Date.now },
  endedAt: { type: Date },
  totalDuration: { type: Number },
  
  callStatus: { 
    type: String, 
    enum: ['ongoing', 'completed', 'missed', 'rejected', 'failed'],
    default: 'ongoing',
    index: true 
  },
  
  isRecorded: { type: Boolean, default: false },
  recordingUrl: { type: String },
  recordingDuration: { type: Number },
  
  avgQuality: { type: Number, min: 0, max: 100 },
  networkIssues: [{ type: String }],
}, { timestamps: true });

// Indexes
CallHistorySchema.index({ channelId: 1, startedAt: -1 });
CallHistorySchema.index({ initiatorId: 1, startedAt: -1 });
CallHistorySchema.index({ 'participants.userId': 1, startedAt: -1 });
CallHistorySchema.index({ callStatus: 1, startedAt: -1 });

// Methods
CallHistorySchema.methods.endCall = async function() {
  this.endedAt = new Date();
  this.callStatus = 'completed';
  this.totalDuration = Math.floor((this.endedAt - this.startedAt) / 1000);
  
  // Calculate individual durations
  this.participants.forEach(p => {
    if (!p.leftAt) p.leftAt = this.endedAt;
    p.duration = Math.floor((p.leftAt - p.joinedAt) / 1000);
  });
  
  return this.save();
};

export default mongoose.models.CallHistory || 
  mongoose.model<ICallHistory>('CallHistory', CallHistorySchema);
4. Presence Model (New)
File: models/Presence.ts
typescriptimport mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPresence extends Document {
  userId: Types.ObjectId;
  status: 'online' | 'away' | 'dnd' | 'offline';
  customStatus?: string;
  lastActiveAt: Date;
  currentChannelId?: Types.ObjectId;
  
  // Device info
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  socketId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const PresenceSchema = new Schema<IPresence>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { 
    type: String, 
    enum: ['online', 'away', 'dnd', 'offline'], 
    default: 'offline',
    index: true 
  },
  customStatus: { type: String, maxlength: 100 },
  lastActiveAt: { type: Date, default: Date.now },
  currentChannelId: { type: Schema.Types.ObjectId, ref: 'Channel' },
  
  deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
  socketId: { type: String },
}, { timestamps: true });

// Indexes
PresenceSchema.index({ userId: 1, status: 1 });
PresenceSchema.index({ lastActiveAt: 1 }); // For cleanup

// Auto-set to away after 5 minutes
PresenceSchema.methods.checkIdleStatus = async function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (this.status === 'online' && this.lastActiveAt < fiveMinutesAgo) {
    this.status = 'away';
    return this.save();
  }
  return this;
};

export default mongoose.models.Presence || 
  mongoose.model<IPresence>('Presence', PresenceSchema);

✅ Validation Layer
Enhanced Communication Validation
File: lib/validations/communication.ts
typescriptimport { z } from 'zod';

export const COMMUNICATION_CONSTANTS = {
  MESSAGE: { 
    MIN_LENGTH: 1, 
    MAX_LENGTH: 10000 // Extended for long messages
  },
  FILE: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_FILES: 10,
    ALLOWED_TYPES: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
    ],
  },
  VOICE: {
    MAX_DURATION: 300, // 5 minutes in seconds
    SAMPLE_RATE: 48000,
  },
  REACTION: {
    ALLOWED_EMOJIS: ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'],
  },
} as const;

// Attachment schema
export const attachmentSchema = z.object({
  url: z.string().url(),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(COMMUNICATION_CONSTANTS.FILE.MAX_SIZE),
  mimeType: z.enum(COMMUNICATION_CONSTANTS.FILE.ALLOWED_TYPES as any),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().int().positive().optional(),
});

// Message schema
export const messageSchema = z.object({
  channelId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid channel ID'),
  message: z.string()
    .min(COMMUNICATION_CONSTANTS.MESSAGE.MIN_LENGTH)
    .max(COMMUNICATION_CONSTANTS.MESSAGE.MAX_LENGTH)
    .trim(),
  messageType: z.enum(['text', 'file', 'voice', 'system']).default('text'),
  attachments: z.array(attachmentSchema).max(COMMUNICATION_CONSTANTS.FILE.MAX_FILES).optional(),
  parentMessageId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  mentions: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
}).refine(
  (data) => {
    // File/voice messages must have attachments
    if ((data.messageType === 'file' || data.messageType === 'voice') && 
        (!data.attachments || data.attachments.length === 0)) {
      return false;
    }
    return true;
  },
  { message: 'File and voice messages must include attachments' }
);

// Edit message schema
export const editMessageSchema = z.object({
  messageId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  message: z.string()
    .min(COMMUNICATION_CONSTANTS.MESSAGE.MIN_LENGTH)
    .max(COMMUNICATION_CONSTANTS.MESSAGE.MAX_LENGTH)
    .trim(),
});

// Reaction schema
export const reactionSchema = z.object({
  messageId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  emoji: z.string().emoji(),
});

// Message query schema
export const messageQuerySchema = z.object({
  channelId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  beforeTimestamp: z.coerce.date().optional(), // For pagination
  search: z.string().max(500).optional(),
  hasAttachments: z.coerce.boolean().optional(),
  parentMessageId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(), // Thread filter
});

// Search schema
export const searchSchema = z.object({
  query: z.string().min(2).max(500),
  channelIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
  senderId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  hasAttachments: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type MessageData = z.infer<typeof messageSchema>;
export type EditMessageData = z.infer<typeof editMessageSchema>;
export type ReactionData = z.infer<typeof reactionSchema>;
export type MessageQueryParams = z.infer<typeof messageQuerySchema>;
export type SearchParams = z.infer<typeof searchSchema>;
Channel Validation
File: lib/validations/channel.ts
typescriptimport { z } from 'zod';

export const CHANNEL_CONSTANTS = {
  NAME: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
  DESCRIPTION: { MAX_LENGTH: 500 },
  PARTICIPANTS: { MAX_COUNT: 500 }, // For large group channels
} as const;

// Participant schema
export const participantSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
  notificationPreference: z.enum(['all', 'mentions', 'none']).default('all'),
});

// Create channel schema
export const createChannelSchema = z.object({
  name: z.string()
    .min(CHANNEL_CONSTANTS.NAME.MIN_LENGTH)
    .max(CHANNEL_CONSTANTS.NAME.MAX_LENGTH)
    .trim(),
  description: z.string()
    .max(CHANNEL_CONSTANTS.DESCRIPTION.MAX_LENGTH)
    .trim()
    .optional(),
  channelType: z.enum(['dm', 'general', 'project', 'department']),
  participants: z.array(participantSchema)
    .min(1)
    .max(CHANNEL_CONSTANTS.PARTICIPANTS.MAX_COUNT),
  is_private: z.boolean().default(false),
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  departmentId: z.string().optional(),
}).refine(
  (data) => {
    // DM must have exactly 2 participants
    if (data.channelType === 'dm' && data.participants.length !== 2) {
      return false;
    }
    // Project channels must have projectId
    if (data.channelType === 'project' && !data.projectId) {
      return false;
    }
    // Department channels must have departmentId
    if (data.channelType === 'department' && !data.departmentId) {
      return false;
    }
    return true;
  },
  { message: 'Invalid channel configuration' }
);

// Update channel schema
export const updateChannelSchema = z.object({
  name: z.string()
    .min(CHANNEL_CONSTANTS.NAME.MIN_LENGTH)
    .max(CHANNEL_CONSTANTS.NAME.MAX_LENGTH)
    .trim()
    .optional(),
  description: z.string()
    .max(CHANNEL_CONSTANTS.DESCRIPTION.MAX_LENGTH)
    .trim()
    .optional(),
  isArchived: z.boolean().optional(),
  isReadOnly: z.boolean().optional(),
  avatar: z.string().url().optional(),
});

// Channel query schema
export const channelQuerySchema = z.object({
  channelType: z.enum(['dm', 'general', 'project', 'department']).optional(),
  isArchived: z.coerce.boolean().default(false),
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  departmentId: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateChannelData = z.infer<typeof createChannelSchema>;
export type UpdateChannelData = z.infer<typeof updateChannelSchema>;
export type ChannelQueryParams = z.infer<typeof channelQuerySchema>;
Call Validation
File: lib/validations/call.ts
typescriptimport { z } from 'zod';

export const CALL_CONSTANTS = {
  MAX_PARTICIPANTS: 50,
  MAX_DURATION: 4 * 60 * 60, // 4 hours in seconds
} as const;

// Call initiation schema
export const initiateCallSchema = z.object({
  channelId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  callType: z.enum(['voice', 'video']),
  participantIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/))
    .max(CALL_CONSTANTS.MAX_PARTICIPANTS),
});

// WebRTC signaling schemas
export const webrtcOfferSchema = z.object({
  callId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  sdp: z.string(),
  type: z.literal('offer'),
});

export const webrtcAnswerSchema = z.object({
  callId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  sdp: z.string(),
  type: z.literal('answer'),
});

export const iceCandidateSchema = z.object({
  callId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  candidate: z.string(),
  sdpMLineIndex: z.number().int().optional(),
  sdpMid: z.string().optional(),
});

// Call history query schema
export const callHistoryQuerySchema = z.object({
  channelId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  callType: z.enum(['voice', 'video']).optional(),
  callStatus: z.enum(['ongoing', 'completed', 'missed', 'rejected', 'failed']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type InitiateCallData = z.infer<typeof initiateCallSchema>;
export type WebRTCOfferData = z.infer<typeof webrtcOfferSchema>;
export type WebRTCAnswerData = z.infer<typeof webrtcAnswerSchema>;
export type ICECandidateData = z.infer<typeof iceCandidateSchema>;
export type CallHistoryQueryParams = z.infer<typeof callHistoryQuerySchema>;

🔌 API Layer
Socket.io Server Setup
File: lib/socket/server.ts
typescriptimport { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { verifyJwt } from '@/lib/auth';
import { ApiPermissionManager } from '@/lib/api-permissions';
import type { IUser } from '@/models/User';

// Extend Socket interface with user data
interface AuthenticatedSocket extends Socket {
  user: IUser & { id: string };
}

let io: SocketIOServer | null = null;

export async function initializeSocketServer(httpServer: HTTPServer): Promise<SocketIOServer> {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: '/api/socket/io',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
    maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for file transfers
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis adapter for scaling
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.io Redis adapter connected');
  }

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = await verifyJwt(token);
      
      // Fetch full user data
      const User = (await import('@/models/User')).default;
      const user = await User.findById(decoded.id).lean();
      
      if (!user || !user.is_active) {
        return next(new Error('User not found or inactive'));
      }

      socket.user = { ...user, id: user._id.toString() };
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  // Import and register event handlers
  const { registerMessageHandlers } = await import('./handlers/message');
  const { registerCallHandlers } = await import('./handlers/call');
  const { registerPresenceHandlers } = await import('./handlers/presence');
  const { registerTypingHandlers } = await import('./handlers/typing');

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✅ User connected: ${socket.user.id} (${socket.id})`);

    registerMessageHandlers(io, socket);
    registerCallHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerTypingHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`❌ User disconnected: ${socket.user.id} (${reason})`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.id}:`, error);
    });
  });

  console.log('✅ Socket.io server initialized');
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io server not initialized');
  }
  return io;
}
Message Event Handlers
File: lib/socket/handlers/message.ts
typescriptimport { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../server';
import Communication from '@/models/Communication';
import Channel from '@/models/Channel';
import { messageSchema, reactionSchema } from '@/lib/validations/communication';
import { ApiPermissionManager } from '@/lib/api-permissions';
import { Types } from 'mongoose';

export function registerMessageHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  
  // Join channel room
  socket.on('joinChannel', async (channelId: string, callback) => {
    try {
      // Validate channel ID
      if (!Types.ObjectId.isValid(channelId)) {
        return callback({ error: 'Invalid channel ID' });
      }

      // Check if user has access
      const channel = await Channel.findById(channelId);
      if (!channel) {
        return callback({ error: 'Channel not found' });
      }

      // Verify participant
      const isParticipant = channel.participants.some(
        p => p.userId.toString() === socket.user.id
      );

      if (!isParticipant) {
        // Check permissions for non-participants (e.g., admins)
        const hasAccess = await ApiPermissionManager.hasPermission(
          socket.user,
          { resource: 'communications', action: 'read' },
          channelId
        );

        if (!hasAccess) {
          return callback({ error: 'Access denied' });
        }
      }

      // Join room
      socket.join(`channel:${channelId}`);
      
      // Update last read timestamp
      await channel.updateLastRead(new Types.ObjectId(socket.user.id));

      callback({ success: true, channelId });
      console.log(`User ${socket.user.id} joined channel ${channelId}`);
      
    } catch (error) {
      console.error('joinChannel error:', error);
      callback({ error: 'Failed to join channel' });
    }
  });

  // Leave channel room
  socket.on('leaveChannel', (channelId: string) => {
    socket.leave(`channel:${channelId}`);
    console.log(`User ${socket.user.id} left channel ${channelId}`);
  });

  // Send message
  socket.on('sendMessage', async (data, callback) => {
    try {
      // Validate message data
      const validated = messageSchema.safeParse(data);
      if (!validated.success) {
        return callback({ error: 'Invalid message data', details: validated.error.errors });
      }

      const { channelId, message, messageType, attachments, parentMessageId, mentions } = validated.data;

      // Check permissions
      const hasPermission = await ApiPermissionManager.hasPermission(
        socket.user,
        { resource: 'communications', action: 'create' },
        channelId
      );

      if (!hasPermission) {
        return callback({ error: 'Permission denied' });
      }

      // Check if channel is read-only
      const channel = await Channel.findById(channelId);
      if (channel?.isReadOnly) {
        const isAdmin = channel.participants.find(
          p => p.userId.toString() === socket.user.id && p.role === 'admin'
        );
        if (!isAdmin) {
          return callback({ error: 'Channel is read-only' });
        }
      }

      // Create message
      const newMessage = await Communication.create({
        channelId: new Types.ObjectId(channelId),
        senderId: new Types.ObjectId(socket.user.id),
        senderModel: socket.user.role === 'client' ? 'Client' : 'User',
        message,
        messageType,
        attachments: attachments || [],
        parentMessageId: parentMessageId ? new Types.ObjectId(parentMessageId) : undefined,
        mentions: mentions?.map(id => new Types.ObjectId(id)) || [],
      });

      // Populate sender info
      await newMessage.populate('senderId', 'name avatar_url email');

      // Update channel stats
      await Channel.findByIdAndUpdate(channelId, {
        $inc: { messageCount: 1 },
        lastMessageAt: new Date(),
      });

      // Broadcast to channel
      io.to(`channel:${channelId}`).emit('newMessage', {
        channelId,
        message: newMessage.toObject(),
      });

      // Send notifications to mentioned users
      if (mentions && mentions.length > 0) {
        mentions.forEach(userId => {
          io.to(`user:${userId}`).emit('mention', {
            messageId: newMessage._id,
            channelId,
            senderId: socket.user.id,
            message: message.substring(0, 100),
          });
        });
      }

      callback({ success: true, messageId: newMessage._id });
      
    } catch (error) {
      console.error('sendMessage error:', error);
      callback({ error: 'Failed to send message' });
    }
  });

  // Edit message
  socket.on('editMessage', async (data, callback) => {
    try {
      const { messageId, message } = data;

      const existingMessage = await Communication.findById(messageId);
      if (!existingMessage) {
        return callback({ error: 'Message not found' });
      }

      // Verify ownership
      if (existingMessage.senderId.toString() !== socket.user.id) {
        return callback({ error: 'Can only edit own messages' });
      }

      // Update message
      existingMessage.message = message;
      existingMessage.isEdited = true;
      existingMessage.editedAt = new Date();
      awaitRetryClaude does not have the ability to run the code it generates yet.AHContinuetypescript      await existingMessage.save();

      // Broadcast update
      io.to(`channel:${existingMessage.channelId}`).emit('messageEdited', {
        messageId: existingMessage._id,
        channelId: existingMessage.channelId,
        message,
        editedAt: existingMessage.editedAt,
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('editMessage error:', error);
      callback({ error: 'Failed to edit message' });
    }
  });

  // Delete message
  socket.on('deleteMessage', async (messageId: string, callback) => {
    try {
      const message = await Communication.findById(messageId);
      if (!message) {
        return callback({ error: 'Message not found' });
      }

      // Verify ownership or admin
      const channel = await Channel.findById(message.channelId);
      const isOwner = message.senderId.toString() === socket.user.id;
      const isAdmin = channel?.participants.find(
        p => p.userId.toString() === socket.user.id && 
        (p.role === 'admin' || p.role === 'owner')
      );

      if (!isOwner && !isAdmin) {
        return callback({ error: 'Permission denied' });
      }

      // Soft delete
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedBy = new Types.ObjectId(socket.user.id);
      await message.save();

      // Broadcast deletion
      io.to(`channel:${message.channelId}`).emit('messageDeleted', {
        messageId: message._id,
        channelId: message.channelId,
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('deleteMessage error:', error);
      callback({ error: 'Failed to delete message' });
    }
  });

  // Add reaction
  socket.on('addReaction', async (data, callback) => {
    try {
      const validated = reactionSchema.safeParse(data);
      if (!validated.success) {
        return callback({ error: 'Invalid reaction data' });
      }

      const { messageId, emoji } = validated.data;

      const message = await Communication.findById(messageId);
      if (!message) {
        return callback({ error: 'Message not found' });
      }

      await message.addReaction(emoji, new Types.ObjectId(socket.user.id));

      // Broadcast reaction
      io.to(`channel:${message.channelId}`).emit('reactionAdded', {
        messageId,
        channelId: message.channelId,
        emoji,
        userId: socket.user.id,
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('addReaction error:', error);
      callback({ error: 'Failed to add reaction' });
    }
  });

  // Pin message
  socket.on('pinMessage', async (messageId: string, callback) => {
    try {
      const message = await Communication.findById(messageId);
      if (!message) {
        return callback({ error: 'Message not found' });
      }

      // Check admin permissions
      const channel = await Channel.findById(message.channelId);
      const isAdmin = channel?.participants.find(
        p => p.userId.toString() === socket.user.id && 
        (p.role === 'admin' || p.role === 'owner')
      );

      if (!isAdmin) {
        return callback({ error: 'Only admins can pin messages' });
      }

      message.isPinned = !message.isPinned;
      message.pinnedBy = message.isPinned ? new Types.ObjectId(socket.user.id) : undefined;
      message.pinnedAt = message.isPinned ? new Date() : undefined;
      await message.save();

      // Broadcast pin status
      io.to(`channel:${message.channelId}`).emit('messagePinned', {
        messageId,
        channelId: message.channelId,
        isPinned: message.isPinned,
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('pinMessage error:', error);
      callback({ error: 'Failed to pin message' });
    }
  });

  // Mark messages as read
  socket.on('markAsRead', async (data, callback) => {
    try {
      const { channelId, messageIds } = data;

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return callback({ error: 'Invalid message IDs' });
      }

      // Update messages
      await Communication.updateMany(
        { 
          _id: { $in: messageIds.map(id => new Types.ObjectId(id)) },
          channelId: new Types.ObjectId(channelId),
        },
        {
          $addToSet: { readBy: new Types.ObjectId(socket.user.id) },
        }
      );

      // Update channel last read
      await Channel.findByIdAndUpdate(channelId, {
        'participants.$[elem].lastReadAt': new Date(),
      }, {
        arrayFilters: [{ 'elem.userId': new Types.ObjectId(socket.user.id) }],
      });

      // Broadcast read receipts
      io.to(`channel:${channelId}`).emit('messagesRead', {
        channelId,
        messageIds,
        userId: socket.user.id,
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('markAsRead error:', error);
      callback({ error: 'Failed to mark as read' });
    }
  });
}
Call Event Handlers
File: lib/socket/handlers/call.ts
typescriptimport { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../server';
import CallHistory from '@/models/CallHistory';
import Channel from '@/models/Channel';
import { initiateCallSchema, webrtcOfferSchema, webrtcAnswerSchema, iceCandidateSchema } from '@/lib/validations/call';
import { Types } from 'mongoose';

// Store active calls in memory (use Redis in production)
const activeCalls = new Map<string, {
  callId: string;
  channelId: string;
  initiatorId: string;
  participants: Map<string, { socketId: string; hasVideo: boolean; isMuted: boolean }>;
  startedAt: Date;
}>();

export function registerCallHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  
  // Initiate call
  socket.on('initiateCall', async (data, callback) => {
    try {
      const validated = initiateCallSchema.safeParse(data);
      if (!validated.success) {
        return callback({ error: 'Invalid call data', details: validated.error.errors });
      }

      const { channelId, callType, participantIds } = validated.data;

      // Verify channel access
      const channel = await Channel.findById(channelId);
      if (!channel) {
        return callback({ error: 'Channel not found' });
      }

      const isParticipant = channel.participants.some(
        p => p.userId.toString() === socket.user.id
      );

      if (!isParticipant) {
        return callback({ error: 'Not a channel participant' });
      }

      // Create call history record
      const callHistory = await CallHistory.create({
        channelId: new Types.ObjectId(channelId),
        callType,
        initiatorId: new Types.ObjectId(socket.user.id),
        participants: [{
          userId: new Types.ObjectId(socket.user.id),
          joinedAt: new Date(),
          hasVideo: callType === 'video',
          isMuted: false,
        }],
        startedAt: new Date(),
        callStatus: 'ongoing',
      });

      // Store active call
      activeCalls.set(callHistory._id.toString(), {
        callId: callHistory._id.toString(),
        channelId,
        initiatorId: socket.user.id,
        participants: new Map([[socket.user.id, {
          socketId: socket.id,
          hasVideo: callType === 'video',
          isMuted: false,
        }]]),
        startedAt: new Date(),
      });

      // Join call room
      socket.join(`call:${callHistory._id}`);

      // Notify participants
      participantIds.forEach(userId => {
        io.to(`user:${userId}`).emit('incomingCall', {
          callId: callHistory._id,
          channelId,
          callType,
          initiatorId: socket.user.id,
          initiatorName: socket.user.name,
        });
      });

      callback({ 
        success: true, 
        callId: callHistory._id,
        channelId,
      });
      
    } catch (error) {
      console.error('initiateCall error:', error);
      callback({ error: 'Failed to initiate call' });
    }
  });

  // Join call
  socket.on('joinCall', async (data, callback) => {
    try {
      const { callId } = data;

      const callHistory = await CallHistory.findById(callId);
      if (!callHistory || callHistory.callStatus !== 'ongoing') {
        return callback({ error: 'Call not found or ended' });
      }

      // Verify channel access
      const channel = await Channel.findById(callHistory.channelId);
      const isParticipant = channel?.participants.some(
        p => p.userId.toString() === socket.user.id
      );

      if (!isParticipant) {
        return callback({ error: 'Not a channel participant' });
      }

      // Add to call history
      callHistory.participants.push({
        userId: new Types.ObjectId(socket.user.id),
        joinedAt: new Date(),
        hasVideo: callHistory.callType === 'video',
        isMuted: false,
      });
      await callHistory.save();

      // Update active call
      const activeCall = activeCalls.get(callId);
      if (activeCall) {
        activeCall.participants.set(socket.user.id, {
          socketId: socket.id,
          hasVideo: callHistory.callType === 'video',
          isMuted: false,
        });
      }

      // Join call room
      socket.join(`call:${callId}`);

      // Notify other participants
      socket.to(`call:${callId}`).emit('participantJoined', {
        callId,
        userId: socket.user.id,
        userName: socket.user.name,
        hasVideo: callHistory.callType === 'video',
      });

      // Send current participants to new joiner
      const currentParticipants = Array.from(activeCall?.participants.entries() || [])
        .filter(([id]) => id !== socket.user.id)
        .map(([userId, data]) => ({
          userId,
          hasVideo: data.hasVideo,
          isMuted: data.isMuted,
        }));

      callback({ 
        success: true,
        callId,
        participants: currentParticipants,
      });
      
    } catch (error) {
      console.error('joinCall error:', error);
      callback({ error: 'Failed to join call' });
    }
  });

  // Leave call
  socket.on('leaveCall', async (callId: string, callback) => {
    try {
      const callHistory = await CallHistory.findById(callId);
      if (!callHistory) {
        return callback({ error: 'Call not found' });
      }

      // Update participant left time
      const participant = callHistory.participants.find(
        p => p.userId.toString() === socket.user.id && !p.leftAt
      );

      if (participant) {
        participant.leftAt = new Date();
        participant.duration = Math.floor((participant.leftAt - participant.joinedAt) / 1000);
        await callHistory.save();
      }

      // Remove from active call
      const activeCall = activeCalls.get(callId);
      if (activeCall) {
        activeCall.participants.delete(socket.user.id);

        // End call if no participants left
        if (activeCall.participants.size === 0) {
          await callHistory.endCall();
          activeCalls.delete(callId);
          io.to(`call:${callId}`).emit('callEnded', { callId });
        }
      }

      // Leave room
      socket.leave(`call:${callId}`);

      // Notify others
      socket.to(`call:${callId}`).emit('participantLeft', {
        callId,
        userId: socket.user.id,
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('leaveCall error:', error);
      callback({ error: 'Failed to leave call' });
    }
  });

  // WebRTC Signaling: Send offer
  socket.on('webrtc:offer', async (data, callback) => {
    try {
      const validated = webrtcOfferSchema.safeParse(data);
      if (!validated.success) {
        return callback({ error: 'Invalid offer data' });
      }

      const { callId, targetUserId, sdp } = validated.data;

      // Get target socket
      const activeCall = activeCalls.get(callId);
      const targetParticipant = activeCall?.participants.get(targetUserId);

      if (!targetParticipant) {
        return callback({ error: 'Target user not in call' });
      }

      // Forward offer to target
      io.to(targetParticipant.socketId).emit('webrtc:offer', {
        callId,
        fromUserId: socket.user.id,
        sdp,
        type: 'offer',
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('webrtc:offer error:', error);
      callback({ error: 'Failed to send offer' });
    }
  });

  // WebRTC Signaling: Send answer
  socket.on('webrtc:answer', async (data, callback) => {
    try {
      const validated = webrtcAnswerSchema.safeParse(data);
      if (!validated.success) {
        return callback({ error: 'Invalid answer data' });
      }

      const { callId, targetUserId, sdp } = validated.data;

      const activeCall = activeCalls.get(callId);
      const targetParticipant = activeCall?.participants.get(targetUserId);

      if (!targetParticipant) {
        return callback({ error: 'Target user not in call' });
      }

      io.to(targetParticipant.socketId).emit('webrtc:answer', {
        callId,
        fromUserId: socket.user.id,
        sdp,
        type: 'answer',
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('webrtc:answer error:', error);
      callback({ error: 'Failed to send answer' });
    }
  });

  // WebRTC Signaling: Send ICE candidate
  socket.on('webrtc:ice-candidate', async (data, callback) => {
    try {
      const validated = iceCandidateSchema.safeParse(data);
      if (!validated.success) {
        return callback({ error: 'Invalid ICE candidate' });
      }

      const { callId, targetUserId, candidate, sdpMLineIndex, sdpMid } = validated.data;

      const activeCall = activeCalls.get(callId);
      const targetParticipant = activeCall?.participants.get(targetUserId);

      if (!targetParticipant) {
        return callback({ error: 'Target user not in call' });
      }

      io.to(targetParticipant.socketId).emit('webrtc:ice-candidate', {
        callId,
        fromUserId: socket.user.id,
        candidate,
        sdpMLineIndex,
        sdpMid,
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('webrtc:ice-candidate error:', error);
      callback({ error: 'Failed to send ICE candidate' });
    }
  });

  // Toggle video
  socket.on('toggleVideo', async (data, callback) => {
    try {
      const { callId, hasVideo } = data;

      const activeCall = activeCalls.get(callId);
      const participant = activeCall?.participants.get(socket.user.id);

      if (!participant) {
        return callback({ error: 'Not in call' });
      }

      participant.hasVideo = hasVideo;

      // Notify others
      socket.to(`call:${callId}`).emit('participantVideoToggled', {
        callId,
        userId: socket.user.id,
        hasVideo,
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('toggleVideo error:', error);
      callback({ error: 'Failed to toggle video' });
    }
  });

  // Toggle mute
  socket.on('toggleMute', async (data, callback) => {
    try {
      const { callId, isMuted } = data;

      const activeCall = activeCalls.get(callId);
      const participant = activeCall?.participants.get(socket.user.id);

      if (!participant) {
        return callback({ error: 'Not in call' });
      }

      participant.isMuted = isMuted;

      // Notify others
      socket.to(`call:${callId}`).emit('participantMuteToggled', {
        callId,
        userId: socket.user.id,
        isMuted,
      });

      callback({ success: true });
      
    } catch (error) {
      console.error('toggleMute error:', error);
      callback({ error: 'Failed to toggle mute' });
    }
  });
}
Presence Event Handlers
File: lib/socket/handlers/presence.ts
typescriptimport { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../server';
import Presence from '@/models/Presence';
import { Types } from 'mongoose';

export function registerPresenceHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  
  // Update user presence on connect
  socket.on('connect', async () => {
    try {
      // Join user's personal room for notifications
      socket.join(`user:${socket.user.id}`);

      // Update presence
      await Presence.findOneAndUpdate(
        { userId: new Types.ObjectId(socket.user.id) },
        {
          userId: new Types.ObjectId(socket.user.id),
          status: 'online',
          lastActiveAt: new Date(),
          socketId: socket.id,
        },
        { upsert: true, new: true }
      );

      // Broadcast to all users
      io.emit('userStatusChanged', {
        userId: socket.user.id,
        status: 'online',
      });

      console.log(`User ${socket.user.id} is now online`);
      
    } catch (error) {
      console.error('Presence connect error:', error);
    }
  });

  // Update status
  socket.on('updateStatus', async (data, callback) => {
    try {
      const { status, customStatus } = data;

      if (!['online', 'away', 'dnd', 'offline'].includes(status)) {
        return callback({ error: 'Invalid status' });
      }

      const presence = await Presence.findOneAndUpdate(
        { userId: new Types.ObjectId(socket.user.id) },
        {
          status,
          customStatus,
          lastActiveAt: new Date(),
        },
        { new: true }
      );

      // Broadcast status change
      io.emit('userStatusChanged', {
        userId: socket.user.id,
        status,
        customStatus,
      });

      callback({ success: true, presence });
      
    } catch (error) {
      console.error('updateStatus error:', error);
      callback({ error: 'Failed to update status' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      await Presence.findOneAndUpdate(
        { userId: new Types.ObjectId(socket.user.id) },
        {
          status: 'offline',
          lastActiveAt: new Date(),
          socketId: null,
        }
      );

      // Broadcast offline status
      io.emit('userStatusChanged', {
        userId: socket.user.id,
        status: 'offline',
      });

      console.log(`User ${socket.user.id} is now offline`);
      
    } catch (error) {
      console.error('Presence disconnect error:', error);
    }
  });

  // Heartbeat to prevent auto-away
  socket.on('heartbeat', async () => {
    try {
      await Presence.findOneAndUpdate(
        { userId: new Types.ObjectId(socket.user.id) },
        { lastActiveAt: new Date() }
      );
    } catch (error) {
      console.error('Heartbeat error:', error);
    }
  });
}

// Periodic job to set inactive users to 'away' (run every minute)
export async function checkIdleUsers() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const updatedUsers = await Presence.updateMany(
      {
        status: 'online',
        lastActiveAt: { $lt: fiveMinutesAgo },
      },
      { status: 'away' }
    );

    if (updatedUsers.modifiedCount > 0) {
      console.log(`Set ${updatedUsers.modifiedCount} users to 'away'`);
    }
  } catch (error) {
    console.error('checkIdleUsers error:', error);
  }
}
Typing Indicator Handlers
File: lib/socket/handlers/typing.ts
typescriptimport { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../server';

// Store typing timeouts
const typingTimeouts = new Map<string, NodeJS.Timeout>();

export function registerTypingHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  
  socket.on('typing:start', (channelId: string) => {
    try {
      const key = `${socket.user.id}:${channelId}`;

      // Clear existing timeout
      if (typingTimeouts.has(key)) {
        clearTimeout(typingTimeouts.get(key)!);
      }

      // Broadcast typing
      socket.to(`channel:${channelId}`).emit('typing:started', {
        channelId,
        userId: socket.user.id,
        userName: socket.user.name,
      });

      // Auto-stop after 3 seconds
      const timeout = setTimeout(() => {
        socket.to(`channel:${channelId}`).emit('typing:stopped', {
          channelId,
          userId: socket.user.id,
        });
        typingTimeouts.delete(key);
      }, 3000);

      typingTimeouts.set(key, timeout);
      
    } catch (error) {
      console.error('typing:start error:', error);
    }
  });

  socket.on('typing:stop', (channelId: string) => {
    try {
      const key = `${socket.user.id}:${channelId}`;

      // Clear timeout
      if (typingTimeouts.has(key)) {
        clearTimeout(typingTimeouts.get(key)!);
        typingTimeouts.delete(key);
      }

      // Broadcast stop
      socket.to(`channel:${channelId}`).emit('typing:stopped', {
        channelId,
        userId: socket.user.id,
      });
      
    } catch (error) {
      console.error('typing:stop error:', error);
    }
  });
}

🎛️ State Management
Enhanced Communication Slice
File: store/slices/communicationSlice.ts
typescriptimport { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { MessageData, MessageQueryParams } from '@/lib/validations/communication';

interface IMessage extends MessageData {
  _id: string;
  senderId: {
    _id: string;
    name: string;
    avatar_url?: string;
  };
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  readBy: string[];
  reactions: Array<{ emoji: string; userId: string; createdAt: string }>;
  isPinned: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  threadCount: number;
}

interface TypingUser {
  userId: string;
  userName: string;
  timestamp: number;
}

interface CommunicationState {
  messages: Record<string, IMessage[]>;
  selectedChannelId: string | null;
  typingUsers: Record<string, TypingUser[]>;
  loading: boolean;
  sendingMessage: boolean;
  error: string | null;
  hasMore: Record<string, boolean>;
  pagination: Record<string, { page: number; limit: number }>;
}

const initialState: CommunicationState = {
  messages: {},
  selectedChannelId: null,
  typingUsers: {},
  loading: false,
  sendingMessage: false,
  error: null,
  hasMore: {},
  pagination: {},
};

// Thunks
export const fetchMessages = createAsyncThunk(
  'communications/fetchMessages',
  async (params: MessageQueryParams) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`/api/communications?${query}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    
    return response.json();
  }
);

export const sendMessage = createAsyncThunk(
  'communications/sendMessage',
  async (data: MessageData) => {
    const response = await fetch('/api/communications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    return response.json();
  }
);

export const searchMessages = createAsyncThunk(
  'communications/searchMessages',
  async (params: any) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`/api/communications/search?${query}`);
    
    if (!response.ok) {
      throw new Error('Search failed');
    }
    
    return response.json();
  }
);

const communicationSlice = createSlice({
  name: 'communications',
  initialState,
  reducers: {
    setSelectedChannel: (state, action: PayloadAction<string | null>) => {
      state.selectedChannelId = action.payload;
    },

    addMessage: (state, action: PayloadAction<{ channelId: string; message: IMessage }>) => {
      const { channelId, message } = action.payload;
      
      if (!state.messages[channelId]) {
        state.messages[channelId] = [];
      }
      
      // Prevent duplicates
      const exists = state.messages[channelId].some(m => m._id === message._id);
      if (!exists) {
        state.messages[channelId].push(message);
      }
    },

    updateMessage: (state, action: PayloadAction<{ channelId: string; messageId: string; updates: Partial<IMessage> }>) => {
      const { channelId, messageId, updates } = action.payload;
      
      const messages = state.messages[channelId];
      if (messages) {
        const index = messages.findIndex(m => m._id === messageId);
        if (index !== -1) {
          messages[index] = { ...messages[index], ...updates };
        }
      }
    },

    removeMessage: (state, action: PayloadAction<{ channelId: string; messageId: string }>) => {
      const { channelId, messageId } = action.payload;
      
      const messages = state.messages[channelId];
      if (messages) {
        const index = messages.findIndex(m => m._id === messageId);
        if (index !== -1) {
          messages[index].isDeleted = true;
        }
      }
    },

    addTypingUser: (state, action: PayloadAction<{ channelId: string; user: TypingUser }>) => {
      const { channelId, user } = action.payload;
      
      if (!state.typingUsers[channelId]) {
        state.typingUsers[channelId] = [];
      }
      
      // Remove if already exists
      state.typingUsers[channelId] = state.typingUsers[channelId].filter(
        u => u.userId !== user.userId
      );
      
      // Add new
      state.typingUsers[channelId].push(user);
    },

    removeTypingUser: (state, action: PayloadAction<{ channelId: string; userId: string }>) => {
      const { channelId, userId } = action.payload;
      
      if (state.typingUsers[channelId]) {
        state.typingUsers[channelId] = state.typingUsers[channelId].filter(
          u => u.userId !== userId
        );
      }
    },

    clearTypingUsers: (state, action: PayloadAction<string>) => {
      const channelId = action.payload;
      state.typingUsers[channelId] = [];
    },

    addReaction: (state, action: PayloadAction<{ channelId: string; messageId: string; reaction: { emoji: string; userId: string; createdAt: string } }>) => {
      const { channelId, messageId, reaction } = action.payload;
      
      const messages = state.messages[channelId];
      if (messages) {
        const message = messages.find(m => m._id === messageId);
        if (message) {
          // Remove existing reaction from this user with same emoji
          message.reactions = message.reactions.filter(
            r => !(r.userId === reaction.userId && r.emoji === reaction.emoji)
          );
          
          // Add new reaction
          message.reactions.push(reaction);
        }
      }
    },

    markMessagesAsRead: (state, action: PayloadAction<{ channelId: string; messageIds: string[]; userId: string }>) => {
      const { channelId, messageIds, userId } = action.payload;
      
      const messages = state.messages[channelId];
      if (messages) {
        messages.forEach(message => {
          if (messageIds.includes(message._id) && !message.readBy.includes(userId)) {
            message.readBy.push(userId);
            message.isRead = true;
          }
        });
      }
    },

    clearMessages: (state, action: PayloadAction<string>) => {
      const channelId = action.payload;
      delete state.messages[channelId];
      delete state.pagination[channelId];
      delete state.hasMore[channelId];
    },

    clearError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // Fetch messages
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loading = false;

        <!-- continued -->