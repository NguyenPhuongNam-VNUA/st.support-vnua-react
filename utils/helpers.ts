function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function merge(target, ...sources) {
  if (!sources.length) return target;

  for (const source of sources) {
    if (isObject(source)) {
      for (const key in source) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (isObject(sourceValue)) {
          if (!isObject(targetValue)) target[key] = {};
          merge(target[key], sourceValue);
        } else target[key] = sourceValue;
      }
    }
  }

  return target;
}
export function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [result[i], result[randomIndex]] = [result[randomIndex], result[i]];
  }

  return result;
}
export function isEqual(value, other) {
  if (value === other) return true;
  if (value == null || other == null || typeof value !== typeof other) return false;

  if (Array.isArray(value) && Array.isArray(other)) {
    if (value.length !== other.length) return false;
    return value.every((item, index) => isEqual(item, other[index]));
  }

  if (isObject(value) && isObject(other)) {
    const valueKeys = Object.keys(value);
    const otherKeys = Object.keys(other);
    if (valueKeys.length !== otherKeys.length) return false;
    return valueKeys.every(key => isEqual(value[key], other[key]));
  }

  return false;
}
export function generateObjectId() {
  const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
  const machineId = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
  const processId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
  return timestamp + machineId + processId + counter;
}