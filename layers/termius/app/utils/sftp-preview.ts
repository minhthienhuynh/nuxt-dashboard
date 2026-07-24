// Gate for the SFTP file preview: files above this size are not fetched for
// preview at all (still downloadable). 1 MiB comfortably covers logs/config/
// source files without risking a slow fetch or a huge in-memory string.
export const PREVIEW_MAX_SIZE = 1024 * 1024

const SAMPLE_SIZE = 8000
const CONTROL_RATIO_THRESHOLD = 0.3

// Heuristic for whether a fetched file's bytes are text or binary, so the
// preview can show a clear message instead of rendering garbled characters.
// A NUL byte is treated as a definitive binary signal; otherwise binary is
// inferred when more than 30% of the sampled bytes are non-printable control
// characters (excluding tab/newline/CR, which are common in text). Sampling
// only the first 8000 bytes keeps this cheap for large buffers.
export function looksBinary(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, SAMPLE_SIZE))
  if (bytes.length === 0) return false

  let controlCount = 0
  for (const byte of bytes) {
    if (byte === 0) return true
    if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 127) {
      controlCount++
    }
  }
  return controlCount / bytes.length > CONTROL_RATIO_THRESHOLD
}
