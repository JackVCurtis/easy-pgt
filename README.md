# Easy PGT (Pretty Good Trust)

A mobile app for decentralized sharing of trust relationships via Merkle Tree

## Architecture
  -  libsignal for cryptographic primitives
  - Android Plugin bridging to libsignal
  - iOS Plugin bridging to libsignal
  - NFC for Merkle Tree exchange
  - Each user generates a public/private key pair and assigns the public key an opaque UUID
  - Each user maintains a merkle tree of handshakes between users containing both public key and opaque UUID, along with a name for each user to use for the other
  - Users sync Merkle Trees via NFC, adding their own handshake to the tree
  - Users can generate signed messages which include their UUID in a header block and signature in a footer block
  - Users can view the position in their own Merkle Tree of any signed message

## Task Breakdown

1) UI Application (Expo + React Native)

    - [x] Initialize an Expo TypeScript app with a shared design system, linting, and test setup.

    - [ ] Build navigation with tabs and stacks for Handshake flow, Sign Message flow, and View Message Distance flow

    - [ ] Implement reusable UI primitives (buttons, cards, headers, status badges) and consistent dark/light theming.

    - [ ] Create screen-level views backed by mock data for trust relationships, signed messages, and profile identity details.

    - [ ] Add form validation, loading/error states, and empty states so all core screens are demo-ready.

3) Android Plugin (libsignal bridge)

   - [ ] Create an Android native module that exposes key generation, signing, and verification from libsignal to JavaScript.

   - [ ] Define a stable TypeScript interface and validate all JNI/bridge inputs and outputs.

   - [ ] Add instrumentation/unit tests for native crypto calls and bridge error handling.

   - [ ] Package and document plugin integration steps for local development and release builds.

5) iOS Plugin (libsignal bridge)

   - [ ] Create an iOS native module that exposes key generation, signing, and verification from libsignal to JavaScript.

   - [ ]  Define matching TypeScript contracts so iOS and Android return consistent payloads.

   - [ ]  Add XCTest coverage for native crypto operations, failures, and bridge serialization.

   - [ ]  Document plugin setup for CocoaPods/Xcode and Expo prebuild workflows.

7) Merkle Tree Creation and Verification

   - [ ]  Design canonical handshake leaf encoding including UUID, public key, and metadata needed for ordering.

   - [ ] Implement deterministic Merkle tree construction and root generation from local handshake records.

   - [ ]  Implement proof generation/verification APIs for checking whether a signed message identity appears in a tree.

   - [ ]  Add tests for determinism, tamper detection, duplicate handling, and cross-platform compatibility of hashes.

9) NFC File Exchange

   - [ ]  Define a compact exchange format for tree snapshots, proofs, and signature metadata with versioning.

   - [ ]  Implement NFC send/receive flows that serialize, validate, and persist exchanged trust data safely.

   - [ ]  Add conflict resolution rules for merging imported tree data with local handshakes.
   [ ]  Add end-to-end tests for successful exchange, corrupted payload rejection, and recovery UX.
