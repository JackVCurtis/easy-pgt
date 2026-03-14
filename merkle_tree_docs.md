# Research Notes: NFC Exchange of Merkle Tree Handshake Data

Date: 2026-03-14

## Scope

You described a mobile app where two users complete an NFC "handshake" that exchanges:

- public keys
- opaque UUIDs
- each user's current Merkle tree of handshakes
- verification signatures

After the exchange, each device merges the newly learned handshake records into its local Merkle tree. You also said the cryptographic primitives will come from **libsignal**.

This document focuses on **available code examples and libraries** that are directly relevant to that design.

---

## Executive summary

The most useful public examples break into three buckets:

1. **Signal / libsignal session and key-management examples**
   - Best source for identity keys, signed prekeys, session setup, durable key/session stores, and message authenticity patterns.
   - Important caveat: Signal's current `libsignal` repository says use outside Signal is unsupported, and it is licensed AGPL-3.0.

2. **Mobile NFC examples**
   - **Android** has the strongest options for app-to-app NFC via **Host Card Emulation (HCE)** and APDU exchange.
   - **iOS** Core NFC is much more constrained. Public Apple documentation is tag-reader oriented; I did **not** find official public support for iPhone acting as a generic HCE peer for arbitrary app-to-app exchange. That means a cross-platform phone-to-phone NFC protocol will be significantly harder than an Android-first one.

3. **Merkle tree implementations**
   - There are solid Java examples and libraries you can adapt for canonical leaf hashing, ordered insertion, and proof generation/verification.
   - The most important design work is not choosing a library, but making the **leaf serialization canonical** so both devices compute identical roots for the same handshake set.

---

## 1) libsignal / Signal Protocol examples

### A. Current official `libsignal` repository

Repository: `signalapp/libsignal`  
Link: <https://github.com/signalapp/libsignal>

Why it matters:

- Signal says this repo exposes platform-agnostic APIs as **Java, Swift, and TypeScript** libraries.
- The implementation is Rust underneath, with protocol bindings for the client languages.
- The repo explicitly lists `libsignal-protocol` as the replacement for older `libsignal-protocol-java` and related older repos.

Useful findings:

- The README says the repo is used by Signal clients and servers, but also says **use outside of Signal is unsupported**.[^1]
- This is the best starting point if you want modern libsignal primitives instead of building around archived libraries.[^1]

What to mine from it:

- key generation and storage patterns
- signed-prekey lifecycle
- language binding layout for Java/Swift/TypeScript
- tests around identity/session handling

Fit for your app:

- Good fit for **identity keys, signatures, key serialization, authenticated session setup**, and durable state handling.
- Not a Merkle tree library.
- Not an NFC transport library.

Caveat:

- The repo warning means you should review the support and maintenance risk before making it a foundational dependency in a production product.[^1]

---

### B. Archived but still very useful: `libsignal-protocol-java`

Repository: `signalapp/libsignal-protocol-java`  
Link: <https://github.com/signalapp/libsignal-protocol-java>

Why it matters:

Even though it is archived, its README still gives the clearest **small, concrete example** of the lifecycle you will need:

- generate identity key pair
- generate registration ID
- generate prekeys
- generate signed prekey
- implement persistent stores for identity, prekeys, signed prekeys, and sessions
- build a session and encrypt a first message

The README includes install-time example code such as:

- `KeyHelper.generateIdentityKeyPair()`
- `KeyHelper.generateRegistrationId()`
- `KeyHelper.generatePreKeys(...)`
- `KeyHelper.generateSignedPreKey(...)`

It also shows session setup with:

- `SessionBuilder`
- `SessionCipher`
- a persistent `SessionStore`, `PreKeyStore`, `SignedPreKeyStore`, and `IdentityKeyStore`.[^2]

Why this is especially relevant to your design:

Your handshake object includes public keys and signatures. The Signal examples are a good model for:

- **device identity bootstrap**
- **signed statements over key material**
- **durable local state**
- **serialization boundaries**

Suggested adaptation:

Use libsignal for the per-device cryptographic identity and signature system, but keep the NFC handshake payload as **your own application protocol object**, for example:

```text
HandshakePayloadV1 {
  protocolVersion
  handshakeUuid
  initiatorUserUuid
  responderUserUuid
  initiatorIdentityPublicKey
  responderIdentityPublicKey
  initiatorMerkleRoot
  responderMerkleRoot
  initiatorHandshakeSignature
  responderHandshakeSignature
  optionalNovelHandshakeBundle
}
```

Then hash a canonical byte encoding of the final handshake record to produce the Merkle leaf.

Why not copy Signal protocol end-to-end?

Signal's examples are for **message sessions**. Your core problem is **authenticated local data reconciliation over NFC**. That means libsignal is useful for primitives and identity handling, but your application still needs its own:

- handshake schema
- serialization format
- Merkle merge logic
- novelty detection logic

---

### C. Legacy repo notes worth knowing

- `signalapp/SignalProtocolKit` is marked by Signal as **no longer maintained** and says it has been replaced by libsignal-client's Swift API.[^3]
- `signalapp/libsignal-protocol-javascript` is also marked **no longer maintained** and replaced by the newer TypeScript API.[^4]

These are still useful for understanding older API shapes, but I would not use them as the main implementation target for new work.

---

## 2) Android NFC examples

### A. Official Android HCE documentation

Doc: Host-based card emulation overview  
Link: <https://developer.android.com/develop/connectivity/nfc/hce>

Why it matters:

Android's HCE docs are the strongest official reference for **phone-to-phone NFC protocols** where one Android device behaves like a card and another behaves like a reader.

Important details from the doc:

- Android supports host-based card emulation without a secure element.[^5]
- Android HCE can emulate ISO-DEP cards and process APDUs defined by ISO/IEC 7816-4.[^5]
- Android devices can act as readers too, using `IsoDep`, which means Android can support end-to-end reader/emulated-card flows between phones.[^5]

Why this is relevant to your app:

If you want an app-controlled binary exchange instead of just writing an NDEF text record, **APDU-based HCE is the best Android-native path**.

How to map your protocol onto it:

A practical pattern is:

1. Reader sends `SELECT AID`
2. Emulated device returns app/protocol version metadata
3. Reader requests handshake summary
4. Emulated device returns:
   - current Merkle root
   - record count
   - latest handshake IDs or a compact frontier
5. Reader requests missing records in chunks
6. Emulated device returns serialized handshake records plus signatures
7. Reader acks completion
8. Devices swap roles if you want symmetric exchange in one tap session

Why HCE is better than NDEF for your use case:

- APDU lets you do **chunked**, structured binary exchange
- easier to version the protocol
- easier to support request/response pagination for novel handshakes
- better fit for authenticated reconciliation than a single NDEF payload

---

### B. Official Android NFC basics documentation

Doc: NFC basics  
Link: <https://developer.android.com/develop/connectivity/nfc/nfc>

Why it matters:

This is the official reference for **NDEF**-based reading/writing and Android tag dispatch.[^6]

Fit for your app:

- Good if you want the first prototype to simply exchange a **small bootstrap blob** over NDEF.
- Less suitable if you need to transfer many handshake records or perform interactive reconciliation.

A good compromise architecture:

- Use NFC only to exchange:
  - app/user opaque UUID
  - current Merkle root
  - short-lived session nonce
  - optional transport upgrade hint
- Then switch to BLE / local network / QR-assisted channel for the bulk record transfer.

That said, if your data volume stays very small, Android HCE alone can work.

---

### C. Small Android HCE sample repos

#### `justinribeiro/android-hostcardemulation-sample`
Link: <https://github.com/justinribeiro/android-hostcardemulation-sample>

Why it matters:

- Minimal example of Android **Host Card Emulation of a Type 4 tag**.
- The README says it emulates a Type 4 tag with a single NDEF text record and uses a sample AID for APDU selection.[^7]

Usefulness:

- Good skeleton for wiring manifest/service/AID registration.
- Too simple for your final protocol, but a strong starting point for understanding the HCE plumbing.

#### `AndroidCrypto/Android_HCE_Beginner_App`
Link: <https://github.com/AndroidCrypto/Android_HCE_Beginner_App>

Why it matters:

- Public walkthrough app focused on the setup steps for Android HCE and simple data transfer.[^8]

Usefulness:

- Good educational sample.
- I would treat it as a learning aid, not as protocol-grade production code.

---

## 3) iOS NFC examples and constraints

### A. Official Apple Core NFC docs

Docs:

- Core NFC: <https://developer.apple.com/documentation/corenfc>
- Background tag reading: <https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading>
- WWDC 2020 "What's new in Core NFC": <https://developer.apple.com/videos/play/wwdc2020/10209/>

Why it matters:

Apple's public material describes:

- NDEF tag reading/writing
- reader sessions
- native tag protocol access such as ISO7816/FeliCa/MIFARE/ISO15693
- background reading on supported devices in some cases[^9][^10][^11]

What I did **not** find in the public Apple docs I reviewed:

- generic app-level **host card emulation** equivalent to Android HCE
- a public peer-to-peer phone-as-tag / phone-as-reader app framework for arbitrary data exchange

Interpretation:

That strongly suggests your design should assume:

- **Android-first** for true phone-to-phone NFC exchange
- **iOS as tag reader / tag writer / card reader**, not generic app-defined HCE peer

This is an inference from Apple's public documentation surface, not an explicit Apple statement.

Practical impact:

If your product must support both platforms, the cleanest architecture may be:

- Android ↔ Android: NFC HCE/APDU protocol
- iPhone ↔ anything: NFC used only for limited bootstrap, or use a different local transport for the main exchange

---

### B. Small Swift examples

#### `hansemannn/iOS-NFC-Example`
Link: <https://github.com/hansemannn/iOS-NFC-Example>

Why it matters:

- Straightforward Core NFC example using `NFCNDEFReaderSession` for NDEF tags.[^12]

Usefulness:

- Good starting point for understanding the session/delegate flow.
- Only covers the shallow end of the problem; not enough for your handshake protocol by itself.

#### `mjeffers1/nfc-research-ios`
Link: <https://github.com/mjeffers1/nfc-research-ios>

Why it matters:

- Another simple Swift/iOS NDEF-reading example repo.[^13]

Usefulness:

- Useful for rapid prototyping and entitlement/session setup.
- Not enough for app-to-app reconciliation logic.

---

## 4) Cross-platform NFC wrapper examples

If your app is React Native or Flutter, these are the most relevant public examples.

### A. React Native: `revtel/react-native-nfc-manager`

Repo: <https://github.com/revtel/react-native-nfc-manager>  
Examples: <https://github.com/revtel/react-native-nfc-manager/wiki/Examples>

Why it matters:

- Mature React Native NFC wrapper with example code for reading/writing NDEF.[^14][^15]

Usefulness:

- Good if your first milestone is "tap two devices / read a short signed blob / display Merkle root".
- Less ideal if your end state depends heavily on Android HCE/APDU or advanced platform-specific NFC behavior, since you may end up dropping into native modules anyway.

### B. React Native Android HCE: `appidea/react-native-hce`

Repo: <https://github.com/appidea/react-native-hce>

Why it matters:

- Exposes Android Host Card Emulation to React Native and supports Type 4 tag emulation.[^16]

Usefulness:

- Highly relevant if you are building a React Native Android-first prototype.
- Still only part of the system; you would need to design the APDU/NDEF payload protocol yourself.

### C. Flutter: `nfcim/flutter_nfc_kit`

Repo: <https://github.com/nfcim/flutter_nfc_kit>  
Package example: <https://pub.dev/packages/flutter_nfc_kit/example>

Why it matters:

- Provides NFC functionality on Android and iOS, including metadata, NDEF read/write, and layer 3 / 4 transceive operations.[^17][^18]

Usefulness:

- Strong candidate for a Flutter codebase if you want one abstraction for tag/card interactions.
- For Android HCE-specific behavior, verify exactly how much reader/emulation control you still need natively.

---

## 5) Merkle tree code examples

### A. `cardano-foundation/merkle-tree-java`

Repo: <https://github.com/cardano-foundation/merkle-tree-java>

Why it matters:

- Modern Java Merkle tree implementation with proof generation/verification focus.[^19]
- README notes that different implementations can produce different trees and roots depending on structure and insertion order.[^19]

Why that warning matters a lot for your app:

Your system only works cleanly if both parties agree on:

- leaf serialization
- hash algorithm
- leaf insertion order
- duplicate handling rules
- odd-node promotion strategy / tree balancing conventions

This repo is useful not because you are building for Cardano, but because it highlights exactly the cross-implementation consistency problem your protocol must solve.

### B. `quux00/merkle-tree`

Repo: <https://github.com/quux00/merkle-tree>

Why it matters:

- Simpler Java Merkle tree implementation with explanatory README text about binary-tree hashing and root comparison for divergence detection.[^20]

Usefulness:

- Better as a conceptual or educational reference than as a final mobile-ready dependency.

### C. `crums-io/merkle-tree`

Project page: <https://crums-io.github.io/merkle-tree/>

Why it matters:

- Java-oriented Merkle tree library with proof support and a design goal of being easy to understand.[^21]

Usefulness:

- Worth reviewing if your Android implementation is JVM/Kotlin-heavy.

---

## 6) What I would reuse first

If I were building your system today, I would start with this stack:

### Android-first native prototype

- **Crypto / identity / signatures:** official `signalapp/libsignal` plus patterns learned from archived `libsignal-protocol-java` examples[^1][^2]
- **NFC transport:** Android **HCE + APDU** based on official Android HCE docs[^5]
- **Merkle tree:** a small **custom implementation** with a fixed canonical leaf encoding, borrowing test ideas from the Java Merkle repos[^19][^20][^21]

Why custom Merkle instead of a dependency first:

Because your hardest requirement is deterministic behavior, not advanced Merkle features. A tiny custom tree with exhaustive test vectors is often safer than adapting a generic library whose balancing or ordering rules do not exactly match your protocol.

### Cross-platform prototype

If you need to move faster than native code allows:

- **React Native:** `react-native-nfc-manager` for simple NDEF/bootstrap and native Android module for HCE[^14][^16]
- **Flutter:** `flutter_nfc_kit` for tag/card interaction, with the assumption that advanced Android-only HCE still may require native glue[^17]

---

## 7) Gaps you will still need to design yourself

No public example I found solves your exact problem end-to-end. You will still need to define:

### A. Canonical handshake leaf format

You need a strict byte encoding, for example CBOR or protobuf with a fully specified field ordering and normalization policy.

Suggested leaf preimage:

```text
leaf_hash = H(
  "handshake/v1" ||
  handshake_uuid ||
  smaller_user_uuid ||
  larger_user_uuid ||
  initiator_identity_pubkey ||
  responder_identity_pubkey ||
  timestamp_or_counter ||
  initiator_signature ||
  responder_signature
)
```

The important part is that the two participants independently arrive at the exact same bytes.

### B. Novelty detection protocol

Exchanging a full Merkle tree every tap will stop scaling quickly.

More scalable options:

1. exchange only roots first
2. if roots differ, exchange subtree hashes / ranges / frontier summaries
3. request only the missing leaf records
4. validate each imported record before insertion

This is where the Merkle tree becomes a synchronization primitive rather than just an integrity primitive.

### C. Record validation rules

On receipt of a handshake record, verify:

- both signatures are valid
- referenced public keys match the signer identities
- UUID ordering / participant rules are canonical
- record is not malformed or duplicated
- imported Merkle inclusion proofs, if you use them, are valid against the claimed root

### D. Replay and downgrade protection

Your NFC exchange should include:

- protocol version
- nonce / challenge from each side
- maximum record chunk size
- optional transcript hash

Then bind signatures to that negotiated context where needed.

---

## 8) Recommended next implementation step

A practical order of operations is:

1. Build a pure local test harness with:
   - canonical handshake serialization
   - signature verification using libsignal-backed identity keys
   - deterministic Merkle root computation
2. Build Android-only APDU transport over HCE
3. Add chunked missing-record reconciliation
4. Add import validation and duplicate handling
5. Decide what iOS can realistically support in your product scope

That sequence reduces risk because it separates:

- protocol correctness
- cryptographic correctness
- transport correctness

---

## 9) Bottom line

The strongest publicly available building blocks are:

- **libsignal** for identity/signature/session primitives[^1]
- **archived libsignal-protocol-java README examples** for simple, readable client lifecycle code[^2]
- **Android HCE official docs** for app-controlled phone-to-phone NFC exchange[^5]
- **Core NFC docs/examples** for iOS tag interactions, with major platform constraints for symmetric app-to-app NFC[^9][^10][^11]
- **Java Merkle repos** as references for deterministic hashing/tree behavior, not as a substitute for your protocol spec[^19][^20][^21]

If your target is a real NFC handshake protocol between phones, the fastest credible path is **Android-first, APDU-based, with libsignal-backed identities and a custom deterministic Merkle layer**.

---

## References

[^1]: Signal official `libsignal` README and repository overview: <https://github.com/signalapp/libsignal> and its repository text noting Java/Swift/TypeScript bindings, replacement role, AGPL-3.0 license, and unsupported external use. Source viewed via web on 2026-03-14. See also the extracted repository lines in the web session: `turn763119view0`.
[^2]: `signalapp/libsignal-protocol-java` README, especially the sections on install-time key generation, state stores, `SessionBuilder`, and `SessionCipher`. Source viewed via web on 2026-03-14. See `turn867382view0`.
[^3]: `signalapp/SignalProtocolKit` repository note stating the library is no longer maintained and replaced by libsignal-client's Swift API. Source viewed via web on 2026-03-14. See `turn154817search2`.
[^4]: `signalapp/libsignal-protocol-javascript` repository note stating the library is no longer maintained and replaced by libsignal-client's TypeScript API. Source viewed via web on 2026-03-14. See `turn476314search6`.
[^5]: Android Developers, "Host-based card emulation overview," including support for HCE, ISO-DEP, APDUs, and end-to-end Android reader/emulated-card architecture. Source viewed via web on 2026-03-14. See `turn763119view2`.
[^6]: Android Developers, "NFC basics," describing NDEF exchange and Android tag dispatch. Source viewed via web on 2026-03-14. See `turn763119view3`.
[^7]: `justinribeiro/android-hostcardemulation-sample` README, describing Type 4 tag emulation with a single NDEF text record and sample AID. Source viewed via web on 2026-03-14. See `turn250265search10` and `turn189286search4`.
[^8]: `AndroidCrypto/Android_HCE_Beginner_App` repository description. Source viewed via web on 2026-03-14. See `turn189286search12`.
[^9]: Apple Developer documentation for Core NFC. Source viewed via web on 2026-03-14. See `turn408246search0` / `turn763119view4`.
[^10]: Apple Developer documentation for background tag reading. Source viewed via web on 2026-03-14. See `turn408246search4`.
[^11]: Apple WWDC 2020, "What's new in Core NFC," describing NDEF reading/writing and native tag protocol access. Source viewed via web on 2026-03-14. See `turn408246search7`.
[^12]: `hansemannn/iOS-NFC-Example` README. Source viewed via web on 2026-03-14. See `turn189286search1` and `turn189286search17`.
[^13]: `mjeffers1/nfc-research-ios` README. Source viewed via web on 2026-03-14. See `turn189286search13`.
[^14]: `revtel/react-native-nfc-manager` repository and wiki examples. Source viewed via web on 2026-03-14. See `turn189286search6` and `turn189286search2`.
[^15]: `revtel/react-native-nfc-manager` example code showing `NfcManager.start()` and NDEF handling. Source viewed via web on 2026-03-14. See `turn189286search6` and `turn189286search2`.
[^16]: `appidea/react-native-hce` repository description. Source viewed via web on 2026-03-14. See `turn189286search0`.
[^17]: `nfcim/flutter_nfc_kit` repository description. Source viewed via web on 2026-03-14. See `turn189286search3`.
[^18]: `flutter_nfc_kit` package example page. Source viewed via web on 2026-03-14. See `turn189286search19`.
[^19]: `cardano-foundation/merkle-tree-java` README, especially the warning that different implementations can produce different trees and roots depending on structure and insertion order. Source viewed via web on 2026-03-14. See `turn763119view5`.
[^20]: `quux00/merkle-tree` README summary. Source viewed via web on 2026-03-14. See `turn250265search8`.
[^21]: `crums-io/merkle-tree` project page. Source viewed via web on 2026-03-14. See `turn250265search15`.

---

## Architecture Decision Update (Hybrid NFC → Bluetooth LE)

**Design decision:** The system will use a **hybrid architecture** where NFC is used only for **secure bootstrapping**, and a **Bluetooth Low Energy (BLE)** connection is used for transferring larger datasets such as Merkle trees and handshake logs.

### Why this change

NFC bandwidth is extremely limited (typically ≤424 kbps and often far less in real implementations). Exchanging complete Merkle trees or large numbers of handshake records directly over NFC would be slow and unreliable.

Instead, NFC acts as a **secure proximity-based pairing channel**, after which the devices establish a higher-bandwidth Bluetooth connection.

This architecture pattern is used by systems such as:

- Android Beam (NFC → Bluetooth)
- Nearby Share (BLE discovery → WiFi transfer)
- Apple AirDrop (BLE discovery → WiFi transfer)

### Updated handshake flow

1. **NFC tap**
   - Exchange identity public keys
   - Exchange ephemeral session keys
   - Exchange Bluetooth service identifiers
   - Exchange device UUIDs
   - Exchange cryptographic signatures binding the handshake

2. **Bluetooth connection established**
   - Device discovery via BLE service UUID obtained during NFC step
   - BLE GATT connection established

3. **Secure session establishment**
   - Use **libsignal primitives** (IdentityKey, SignedPreKey, etc.)
   - Establish authenticated encrypted session

4. **Merkle tree synchronization**
   - Exchange Merkle root hashes
   - If roots differ, perform subtree comparison
   - Request missing leaves
   - Transfer missing handshake records

5. **Local state update**
   - Append verified handshake records
   - Recompute Merkle root

### NFC bootstrap payload example

```
{
  protocol_version,
  device_uuid,
  identity_public_key,
  ephemeral_public_key,
  bluetooth_service_uuid,
  signature
}
```

### BLE data exchange

A custom **BLE GATT service** is recommended:

```
MerkleSyncService
  ├─ root_hash_characteristic
  ├─ subtree_request_characteristic
  ├─ subtree_response_characteristic
  └─ handshake_record_characteristic
```

### Security benefits

Using NFC only for bootstrapping provides:

- **Proximity authentication**
- Protection against remote MITM during Bluetooth pairing
- Binding of identity keys to a physical tap event

The Bluetooth channel then carries encrypted application-layer traffic protected by **libsignal session encryption**.
# Research Notes: NFC Exchange of Merkle Tree Handshake Data

Date: 2026-03-14

## Scope

You described a mobile app where two users complete an NFC "handshake" that exchanges:

- public keys
- opaque UUIDs
- each user's current Merkle tree of handshakes
- verification signatures

After the exchange, each device merges the newly learned handshake records into its local Merkle tree. You also said the cryptographic primitives will come from **libsignal**.

This document focuses on **available code examples and libraries** that are directly relevant to that design.

---

## Executive summary

The most useful public examples break into three buckets:

1. **Signal / libsignal session and key-management examples**
   - Best source for identity keys, signed prekeys, session setup, durable key/session stores, and message authenticity patterns.
   - Important caveat: Signal's current `libsignal` repository says use outside Signal is unsupported, and it is licensed AGPL-3.0.

2. **Mobile NFC examples**
   - **Android** has the strongest options for app-to-app NFC via **Host Card Emulation (HCE)** and APDU exchange.
   - **iOS** Core NFC is much more constrained. Public Apple documentation is tag-reader oriented; I did **not** find official public support for iPhone acting as a generic HCE peer for arbitrary app-to-app exchange. That means a cross-platform phone-to-phone NFC protocol will be significantly harder than an Android-first one.

3. **Merkle tree implementations**
   - There are solid Java examples and libraries you can adapt for canonical leaf hashing, ordered insertion, and proof generation/verification.
   - The most important design work is not choosing a library, but making the **leaf serialization canonical** so both devices compute identical roots for the same handshake set.

---

## 1) libsignal / Signal Protocol examples

### A. Current official `libsignal` repository

Repository: `signalapp/libsignal`  
Link: <https://github.com/signalapp/libsignal>

Why it matters:

- Signal says this repo exposes platform-agnostic APIs as **Java, Swift, and TypeScript** libraries.
- The implementation is Rust underneath, with protocol bindings for the client languages.
- The repo explicitly lists `libsignal-protocol` as the replacement for older `libsignal-protocol-java` and related older repos.

Useful findings:

- The README says the repo is used by Signal clients and servers, but also says **use outside of Signal is unsupported**.[^1]
- This is the best starting point if you want modern libsignal primitives instead of building around archived libraries.[^1]

What to mine from it:

- key generation and storage patterns
- signed-prekey lifecycle
- language binding layout for Java/Swift/TypeScript
- tests around identity/session handling

Fit for your app:

- Good fit for **identity keys, signatures, key serialization, authenticated session setup**, and durable state handling.
- Not a Merkle tree library.
- Not an NFC transport library.

Caveat:

- The repo warning means you should review the support and maintenance risk before making it a foundational dependency in a production product.[^1]

---

### B. Archived but still very useful: `libsignal-protocol-java`

Repository: `signalapp/libsignal-protocol-java`  
Link: <https://github.com/signalapp/libsignal-protocol-java>

Why it matters:

Even though it is archived, its README still gives the clearest **small, concrete example** of the lifecycle you will need:

- generate identity key pair
- generate registration ID
- generate prekeys
- generate signed prekey
- implement persistent stores for identity, prekeys, signed prekeys, and sessions
- build a session and encrypt a first message

The README includes install-time example code such as:

- `KeyHelper.generateIdentityKeyPair()`
- `KeyHelper.generateRegistrationId()`
- `KeyHelper.generatePreKeys(...)`
- `KeyHelper.generateSignedPreKey(...)`

It also shows session setup with:

- `SessionBuilder`
- `SessionCipher`
- a persistent `SessionStore`, `PreKeyStore`, `SignedPreKeyStore`, and `IdentityKeyStore`.[^2]

Why this is especially relevant to your design:

Your handshake object includes public keys and signatures. The Signal examples are a good model for:

- **device identity bootstrap**
- **signed statements over key material**
- **durable local state**
- **serialization boundaries**

Suggested adaptation:

Use libsignal for the per-device cryptographic identity and signature system, but keep the NFC handshake payload as **your own application protocol object**, for example:

```text
HandshakePayloadV1 {
  protocolVersion
  handshakeUuid
  initiatorUserUuid
  responderUserUuid
  initiatorIdentityPublicKey
  responderIdentityPublicKey
  initiatorMerkleRoot
  responderMerkleRoot
  initiatorHandshakeSignature
  responderHandshakeSignature
  optionalNovelHandshakeBundle
}
```

Then hash a canonical byte encoding of the final handshake record to produce the Merkle leaf.

Why not copy Signal protocol end-to-end?

Signal's examples are for **message sessions**. Your core problem is **authenticated local data reconciliation over NFC**. That means libsignal is useful for primitives and identity handling, but your application still needs its own:

- handshake schema
- serialization format
- Merkle merge logic
- novelty detection logic

---

### C. Legacy repo notes worth knowing

- `signalapp/SignalProtocolKit` is marked by Signal as **no longer maintained** and says it has been replaced by libsignal-client's Swift API.[^3]
- `signalapp/libsignal-protocol-javascript` is also marked **no longer maintained** and replaced by the newer TypeScript API.[^4]

These are still useful for understanding older API shapes, but I would not use them as the main implementation target for new work.

---

## 2) Android NFC examples

### A. Official Android HCE documentation

Doc: Host-based card emulation overview  
Link: <https://developer.android.com/develop/connectivity/nfc/hce>

Why it matters:

Android's HCE docs are the strongest official reference for **phone-to-phone NFC protocols** where one Android device behaves like a card and another behaves like a reader.

Important details from the doc:

- Android supports host-based card emulation without a secure element.[^5]
- Android HCE can emulate ISO-DEP cards and process APDUs defined by ISO/IEC 7816-4.[^5]
- Android devices can act as readers too, using `IsoDep`, which means Android can support end-to-end reader/emulated-card flows between phones.[^5]

Why this is relevant to your app:

If you want an app-controlled binary exchange instead of just writing an NDEF text record, **APDU-based HCE is the best Android-native path**.

How to map your protocol onto it:

A practical pattern is:

1. Reader sends `SELECT AID`
2. Emulated device returns app/protocol version metadata
3. Reader requests handshake summary
4. Emulated device returns:
   - current Merkle root
   - record count
   - latest handshake IDs or a compact frontier
5. Reader requests missing records in chunks
6. Emulated device returns serialized handshake records plus signatures
7. Reader acks completion
8. Devices swap roles if you want symmetric exchange in one tap session

Why HCE is better than NDEF for your use case:

- APDU lets you do **chunked**, structured binary exchange
- easier to version the protocol
- easier to support request/response pagination for novel handshakes
- better fit for authenticated reconciliation than a single NDEF payload

---

### B. Official Android NFC basics documentation

Doc: NFC basics  
Link: <https://developer.android.com/develop/connectivity/nfc/nfc>

Why it matters:

This is the official reference for **NDEF**-based reading/writing and Android tag dispatch.[^6]

Fit for your app:

- Good if you want the first prototype to simply exchange a **small bootstrap blob** over NDEF.
- Less suitable if you need to transfer many handshake records or perform interactive reconciliation.

A good compromise architecture:

- Use NFC only to exchange:
  - app/user opaque UUID
  - current Merkle root
  - short-lived session nonce
  - optional transport upgrade hint
- Then switch to BLE / local network / QR-assisted channel for the bulk record transfer.

That said, if your data volume stays very small, Android HCE alone can work.

---

### C. Small Android HCE sample repos

#### `justinribeiro/android-hostcardemulation-sample`
Link: <https://github.com/justinribeiro/android-hostcardemulation-sample>

Why it matters:

- Minimal example of Android **Host Card Emulation of a Type 4 tag**.
- The README says it emulates a Type 4 tag with a single NDEF text record and uses a sample AID for APDU selection.[^7]

Usefulness:

- Good skeleton for wiring manifest/service/AID registration.
- Too simple for your final protocol, but a strong starting point for understanding the HCE plumbing.

#### `AndroidCrypto/Android_HCE_Beginner_App`
Link: <https://github.com/AndroidCrypto/Android_HCE_Beginner_App>

Why it matters:

- Public walkthrough app focused on the setup steps for Android HCE and simple data transfer.[^8]

Usefulness:

- Good educational sample.
- I would treat it as a learning aid, not as protocol-grade production code.

---

## 3) iOS NFC examples and constraints

### A. Official Apple Core NFC docs

Docs:

- Core NFC: <https://developer.apple.com/documentation/corenfc>
- Background tag reading: <https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading>
- WWDC 2020 "What's new in Core NFC": <https://developer.apple.com/videos/play/wwdc2020/10209/>

Why it matters:

Apple's public material describes:

- NDEF tag reading/writing
- reader sessions
- native tag protocol access such as ISO7816/FeliCa/MIFARE/ISO15693
- background reading on supported devices in some cases[^9][^10][^11]

What I did **not** find in the public Apple docs I reviewed:

- generic app-level **host card emulation** equivalent to Android HCE
- a public peer-to-peer phone-as-tag / phone-as-reader app framework for arbitrary data exchange

Interpretation:

That strongly suggests your design should assume:

- **Android-first** for true phone-to-phone NFC exchange
- **iOS as tag reader / tag writer / card reader**, not generic app-defined HCE peer

This is an inference from Apple's public documentation surface, not an explicit Apple statement.

Practical impact:

If your product must support both platforms, the cleanest architecture may be:

- Android ↔ Android: NFC HCE/APDU protocol
- iPhone ↔ anything: NFC used only for limited bootstrap, or use a different local transport for the main exchange

---

### B. Small Swift examples

#### `hansemannn/iOS-NFC-Example`
Link: <https://github.com/hansemannn/iOS-NFC-Example>

Why it matters:

- Straightforward Core NFC example using `NFCNDEFReaderSession` for NDEF tags.[^12]

Usefulness:

- Good starting point for understanding the session/delegate flow.
- Only covers the shallow end of the problem; not enough for your handshake protocol by itself.

#### `mjeffers1/nfc-research-ios`
Link: <https://github.com/mjeffers1/nfc-research-ios>

Why it matters:

- Another simple Swift/iOS NDEF-reading example repo.[^13]

Usefulness:

- Useful for rapid prototyping and entitlement/session setup.
- Not enough for app-to-app reconciliation logic.

---

## 4) Cross-platform NFC wrapper examples

If your app is React Native or Flutter, these are the most relevant public examples.

### A. React Native: `revtel/react-native-nfc-manager`

Repo: <https://github.com/revtel/react-native-nfc-manager>  
Examples: <https://github.com/revtel/react-native-nfc-manager/wiki/Examples>

Why it matters:

- Mature React Native NFC wrapper with example code for reading/writing NDEF.[^14][^15]

Usefulness:

- Good if your first milestone is "tap two devices / read a short signed blob / display Merkle root".
- Less ideal if your end state depends heavily on Android HCE/APDU or advanced platform-specific NFC behavior, since you may end up dropping into native modules anyway.

### B. React Native Android HCE: `appidea/react-native-hce`

Repo: <https://github.com/appidea/react-native-hce>

Why it matters:

- Exposes Android Host Card Emulation to React Native and supports Type 4 tag emulation.[^16]

Usefulness:

- Highly relevant if you are building a React Native Android-first prototype.
- Still only part of the system; you would need to design the APDU/NDEF payload protocol yourself.

### C. Flutter: `nfcim/flutter_nfc_kit`

Repo: <https://github.com/nfcim/flutter_nfc_kit>  
Package example: <https://pub.dev/packages/flutter_nfc_kit/example>

Why it matters:

- Provides NFC functionality on Android and iOS, including metadata, NDEF read/write, and layer 3 / 4 transceive operations.[^17][^18]

Usefulness:

- Strong candidate for a Flutter codebase if you want one abstraction for tag/card interactions.
- For Android HCE-specific behavior, verify exactly how much reader/emulation control you still need natively.

---

## 5) Merkle tree code examples

### A. `cardano-foundation/merkle-tree-java`

Repo: <https://github.com/cardano-foundation/merkle-tree-java>

Why it matters:

- Modern Java Merkle tree implementation with proof generation/verification focus.[^19]
- README notes that different implementations can produce different trees and roots depending on structure and insertion order.[^19]

Why that warning matters a lot for your app:

Your system only works cleanly if both parties agree on:

- leaf serialization
- hash algorithm
- leaf insertion order
- duplicate handling rules
- odd-node promotion strategy / tree balancing conventions

This repo is useful not because you are building for Cardano, but because it highlights exactly the cross-implementation consistency problem your protocol must solve.

### B. `quux00/merkle-tree`

Repo: <https://github.com/quux00/merkle-tree>

Why it matters:

- Simpler Java Merkle tree implementation with explanatory README text about binary-tree hashing and root comparison for divergence detection.[^20]

Usefulness:

- Better as a conceptual or educational reference than as a final mobile-ready dependency.

### C. `crums-io/merkle-tree`

Project page: <https://crums-io.github.io/merkle-tree/>

Why it matters:

- Java-oriented Merkle tree library with proof support and a design goal of being easy to understand.[^21]

Usefulness:

- Worth reviewing if your Android implementation is JVM/Kotlin-heavy.

---

## 6) What I would reuse first

If I were building your system today, I would start with this stack:

### Android-first native prototype

- **Crypto / identity / signatures:** official `signalapp/libsignal` plus patterns learned from archived `libsignal-protocol-java` examples[^1][^2]
- **NFC transport:** Android **HCE + APDU** based on official Android HCE docs[^5]
- **Merkle tree:** a small **custom implementation** with a fixed canonical leaf encoding, borrowing test ideas from the Java Merkle repos[^19][^20][^21]

Why custom Merkle instead of a dependency first:

Because your hardest requirement is deterministic behavior, not advanced Merkle features. A tiny custom tree with exhaustive test vectors is often safer than adapting a generic library whose balancing or ordering rules do not exactly match your protocol.

### Cross-platform prototype

If you need to move faster than native code allows:

- **React Native:** `react-native-nfc-manager` for simple NDEF/bootstrap and native Android module for HCE[^14][^16]
- **Flutter:** `flutter_nfc_kit` for tag/card interaction, with the assumption that advanced Android-only HCE still may require native glue[^17]

---

## 7) Gaps you will still need to design yourself

No public example I found solves your exact problem end-to-end. You will still need to define:

### A. Canonical handshake leaf format

You need a strict byte encoding, for example CBOR or protobuf with a fully specified field ordering and normalization policy.

Suggested leaf preimage:

```text
leaf_hash = H(
  "handshake/v1" ||
  handshake_uuid ||
  smaller_user_uuid ||
  larger_user_uuid ||
  initiator_identity_pubkey ||
  responder_identity_pubkey ||
  timestamp_or_counter ||
  initiator_signature ||
  responder_signature
)
```

The important part is that the two participants independently arrive at the exact same bytes.

### B. Novelty detection protocol

Exchanging a full Merkle tree every tap will stop scaling quickly.

More scalable options:

1. exchange only roots first
2. if roots differ, exchange subtree hashes / ranges / frontier summaries
3. request only the missing leaf records
4. validate each imported record before insertion

This is where the Merkle tree becomes a synchronization primitive rather than just an integrity primitive.

### C. Record validation rules

On receipt of a handshake record, verify:

- both signatures are valid
- referenced public keys match the signer identities
- UUID ordering / participant rules are canonical
- record is not malformed or duplicated
- imported Merkle inclusion proofs, if you use them, are valid against the claimed root

### D. Replay and downgrade protection

Your NFC exchange should include:

- protocol version
- nonce / challenge from each side
- maximum record chunk size
- optional transcript hash

Then bind signatures to that negotiated context where needed.

---

## 8) Recommended next implementation step

A practical order of operations is:

1. Build a pure local test harness with:
   - canonical handshake serialization
   - signature verification using libsignal-backed identity keys
   - deterministic Merkle root computation
2. Build Android-only APDU transport over HCE
3. Add chunked missing-record reconciliation
4. Add import validation and duplicate handling
5. Decide what iOS can realistically support in your product scope

That sequence reduces risk because it separates:

- protocol correctness
- cryptographic correctness
- transport correctness

---

## 9) Bottom line

The strongest publicly available building blocks are:

- **libsignal** for identity/signature/session primitives[^1]
- **archived libsignal-protocol-java README examples** for simple, readable client lifecycle code[^2]
- **Android HCE official docs** for app-controlled phone-to-phone NFC exchange[^5]
- **Core NFC docs/examples** for iOS tag interactions, with major platform constraints for symmetric app-to-app NFC[^9][^10][^11]
- **Java Merkle repos** as references for deterministic hashing/tree behavior, not as a substitute for your protocol spec[^19][^20][^21]

If your target is a real NFC handshake protocol between phones, the fastest credible path is **Android-first, APDU-based, with libsignal-backed identities and a custom deterministic Merkle layer**.

---

## References

[^1]: Signal official `libsignal` README and repository overview: <https://github.com/signalapp/libsignal> and its repository text noting Java/Swift/TypeScript bindings, replacement role, AGPL-3.0 license, and unsupported external use. Source viewed via web on 2026-03-14. See also the extracted repository lines in the web session: `turn763119view0`.
[^2]: `signalapp/libsignal-protocol-java` README, especially the sections on install-time key generation, state stores, `SessionBuilder`, and `SessionCipher`. Source viewed via web on 2026-03-14. See `turn867382view0`.
[^3]: `signalapp/SignalProtocolKit` repository note stating the library is no longer maintained and replaced by libsignal-client's Swift API. Source viewed via web on 2026-03-14. See `turn154817search2`.
[^4]: `signalapp/libsignal-protocol-javascript` repository note stating the library is no longer maintained and replaced by libsignal-client's TypeScript API. Source viewed via web on 2026-03-14. See `turn476314search6`.
[^5]: Android Developers, "Host-based card emulation overview," including support for HCE, ISO-DEP, APDUs, and end-to-end Android reader/emulated-card architecture. Source viewed via web on 2026-03-14. See `turn763119view2`.
[^6]: Android Developers, "NFC basics," describing NDEF exchange and Android tag dispatch. Source viewed via web on 2026-03-14. See `turn763119view3`.
[^7]: `justinribeiro/android-hostcardemulation-sample` README, describing Type 4 tag emulation with a single NDEF text record and sample AID. Source viewed via web on 2026-03-14. See `turn250265search10` and `turn189286search4`.
[^8]: `AndroidCrypto/Android_HCE_Beginner_App` repository description. Source viewed via web on 2026-03-14. See `turn189286search12`.
[^9]: Apple Developer documentation for Core NFC. Source viewed via web on 2026-03-14. See `turn408246search0` / `turn763119view4`.
[^10]: Apple Developer documentation for background tag reading. Source viewed via web on 2026-03-14. See `turn408246search4`.
[^11]: Apple WWDC 2020, "What's new in Core NFC," describing NDEF reading/writing and native tag protocol access. Source viewed via web on 2026-03-14. See `turn408246search7`.
[^12]: `hansemannn/iOS-NFC-Example` README. Source viewed via web on 2026-03-14. See `turn189286search1` and `turn189286search17`.
[^13]: `mjeffers1/nfc-research-ios` README. Source viewed via web on 2026-03-14. See `turn189286search13`.
[^14]: `revtel/react-native-nfc-manager` repository and wiki examples. Source viewed via web on 2026-03-14. See `turn189286search6` and `turn189286search2`.
[^15]: `revtel/react-native-nfc-manager` example code showing `NfcManager.start()` and NDEF handling. Source viewed via web on 2026-03-14. See `turn189286search6` and `turn189286search2`.
[^16]: `appidea/react-native-hce` repository description. Source viewed via web on 2026-03-14. See `turn189286search0`.
[^17]: `nfcim/flutter_nfc_kit` repository description. Source viewed via web on 2026-03-14. See `turn189286search3`.
[^18]: `flutter_nfc_kit` package example page. Source viewed via web on 2026-03-14. See `turn189286search19`.
[^19]: `cardano-foundation/merkle-tree-java` README, especially the warning that different implementations can produce different trees and roots depending on structure and insertion order. Source viewed via web on 2026-03-14. See `turn763119view5`.
[^20]: `quux00/merkle-tree` README summary. Source viewed via web on 2026-03-14. See `turn250265search8`.
[^21]: `crums-io/merkle-tree` project page. Source viewed via web on 2026-03-14. See `turn250265search15`.

---

## Architecture Decision Update (Hybrid NFC → Bluetooth LE)

**Design decision:** The system will use a **hybrid architecture** where NFC is used only for **secure bootstrapping**, and a **Bluetooth Low Energy (BLE)** connection is used for transferring larger datasets such as Merkle trees and handshake logs.

### Why this change

NFC bandwidth is extremely limited (typically ≤424 kbps and often far less in real implementations). Exchanging complete Merkle trees or large numbers of handshake records directly over NFC would be slow and unreliable.

Instead, NFC acts as a **secure proximity-based pairing channel**, after which the devices establish a higher-bandwidth Bluetooth connection.

This architecture pattern is used by systems such as:

- Android Beam (NFC → Bluetooth)
- Nearby Share (BLE discovery → WiFi transfer)
- Apple AirDrop (BLE discovery → WiFi transfer)

### Updated handshake flow

1. **NFC tap**
   - Exchange identity public keys
   - Exchange ephemeral session keys
   - Exchange Bluetooth service identifiers
   - Exchange device UUIDs
   - Exchange cryptographic signatures binding the handshake

2. **Bluetooth connection established**
   - Device discovery via BLE service UUID obtained during NFC step
   - BLE GATT connection established

3. **Secure session establishment**
   - Use **libsignal primitives** (IdentityKey, SignedPreKey, etc.)
   - Establish authenticated encrypted session

4. **Merkle tree synchronization**
   - Exchange Merkle root hashes
   - If roots differ, perform subtree comparison
   - Request missing leaves
   - Transfer missing handshake records

5. **Local state update**
   - Append verified handshake records
   - Recompute Merkle root

### NFC bootstrap payload example

```
{
  protocol_version,
  device_uuid,
  identity_public_key,
  ephemeral_public_key,
  bluetooth_service_uuid,
  signature
}
```

### BLE data exchange

A custom **BLE GATT service** is recommended:

```
MerkleSyncService
  ├─ root_hash_characteristic
  ├─ subtree_request_characteristic
  ├─ subtree_response_characteristic
  └─ handshake_record_characteristic
```

### Security benefits

Using NFC only for bootstrapping provides:

- **Proximity authentication**
- Protection against remote MITM during Bluetooth pairing
- Binding of identity keys to a physical tap event

The Bluetooth channel then carries encrypted application-layer traffic protected by **libsignal session encryption**.
