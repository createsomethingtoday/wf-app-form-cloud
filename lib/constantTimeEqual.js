const textEncoder = new TextEncoder();

export function constantTimeEqual(providedValue, expectedValue) {
  if (typeof providedValue !== 'string' || typeof expectedValue !== 'string') {
    return false;
  }

  const provided = textEncoder.encode(providedValue);
  const expected = textEncoder.encode(expectedValue);

  if (provided.length !== expected.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < provided.length; index += 1) {
    mismatch |= provided[index] ^ expected[index];
  }

  return mismatch === 0;
}
