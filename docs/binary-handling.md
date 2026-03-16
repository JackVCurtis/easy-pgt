# Binary Handling in Expo / React Native

## Why `Buffer` is avoided

This project targets Expo and React Native runtimes, which are not Node.js environments.
Node's `Buffer` global is not guaranteed to exist unless a polyfill is introduced. To keep runtime behavior portable and avoid environment-specific shims, application code uses standard typed-array primitives.

## Standard binary representation

Use `Uint8Array` for binary values throughout the app.
Use `ArrayBuffer` only when an external API explicitly requires it.

## Shared helpers

Reusable byte helpers are defined in `app/utils/bytes.ts`:

- `utf8Encode(str)` converts a string to UTF-8 bytes.
- `utf8Decode(bytes)` converts UTF-8 bytes back to string.
- `concatBytes(arrays)` concatenates multiple byte arrays with a single allocation.
- `utf8ByteLength(str)` computes UTF-8 byte length without `Buffer.byteLength`.
- `encodeBase64(bytes)` / `decodeBase64(input)` provide base64 transforms without Node APIs.

## Examples

### UTF-8 encoding and decoding

```ts
const bytes = utf8Encode('hello');
const text = utf8Decode(bytes);
```

### Byte concatenation

```ts
const combined = concatBytes([
  utf8Encode('prefix:'),
  payloadBytes,
]);
```

### Hash input preparation

```ts
const payload = concatBytes([domainPrefixBytes, canonicalRecordBytes]);
const digest = await computeRecordHash(payload);
```

## Contributor guidelines

- Do not import `Buffer` or the `buffer` package in app code.
- Prefer `Uint8Array` for function signatures and return types.
- For lexicographic ordering of binary keys, compare encoded `Uint8Array` values.
- Use helpers in `app/utils/bytes.ts` for UTF-8, base64, and concatenation to keep behavior deterministic.
