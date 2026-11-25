# CloudVault DR — Cloud-Based Disaster Recovery System

A full-stack **Cloud-Based Disaster Recovery System** built strictly with the **MERN stack** (MongoDB Atlas, Express.js, React.js, Node.js) and **JavaScript (ES6+)**.

Uploaded files are stored directly in **MongoDB Atlas GridFS** (`uploads` bucket) alongside independent, versioned backup snapshots (`backups` bucket) and cryptographic **SHA-256** integrity signatures. Even if a user permanently deletes the original file from their local computer, the cloud copy and all backup versions remain safely stored in MongoDB Atlas for preview, download, and restoration.

## Project Structure

```
cloud-disaster-recovery/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── package.json
│   └── server.js
└── README.md
```

## Core Features

- **JWT & bcrypt Authentication**: User registration, sign-in, password updates, and per-user data isolation (`owner`-scoped queries).
- **Multi-File Drag-and-Drop Upload**: Streams files into MongoDB Atlas GridFS (`uploads` bucket) and computes SHA-256 checksums.
- **Automatic & Manual Backups**: Automatically duplicates each uploaded file into an independent GridFS `backups` bucket (`v1`, `v2`, ...), plus on-demand manual snapshot creation.
- **Disaster Recovery Center**: Recover and download files from any stored backup version or restore a previous version back into the active cloud vault, even after local deletion or soft deletion.
- **SHA-256 Integrity Verification**: Re-hashes GridFS streams on demand and prior to recovery downloads to guarantee byte-for-byte authenticity.
- **Recovery History Audit Log**: Tracks every automatic backup, manual snapshot, download, restore, and integrity check.
- **Recycle Bin & Soft Deletion**: Moves files to the Recycle Bin while preserving cloud backup copies, with options to restore or permanently purge GridFS chunks.

## Environment Configuration

Configure the following environment variables in `.env` (or AI Studio Secrets):

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/cloud_disaster_recovery?retryWrites=true&w=majority
PORT=3000
```

> Never commit `.env` or expose database credentials in `frontend/` code.

## Running the Application

```bash
# Development (Express API + Vite middleware on port 3000)
npm run dev

# Production build & start
npm run build
npm start
```

## End-to-End Disaster Recovery Verification

1. Register a new account and sign in.
2. Upload one or more files from your computer via **My Files** or **Dashboard**.
3. Confirm the file appears in **My Files** and an automatic `v1` backup appears in **Backup Management**.
4. Permanently delete the original file from your local computer.
5. Open **My Files** (click **View** or **Download**) or **Disaster Recovery** (click **Recover & Download**).
6. Verify the downloaded file opens cleanly and matches the original SHA-256 signature.
7. Sign in with a second user account and confirm strict isolation (no access to the first user's files or backups).
