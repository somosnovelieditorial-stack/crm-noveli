export const normalizeUuid = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 'undefined' ||
    value === 'null'
  ) {
    return null;
  }
  return value;
};

export const normalizeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
};

export const normalizeDate = (value) => {
  if (!value || value === '' || value === 'undefined' || value === 'dd-mm-aaaa') {
    return null;
  }
  return value;
};

export const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
};
