
// check if data is a GRBL status message
export const isGRBLStatus = (data) => {
  const regex = /<.*>/;
  return regex.test(data);
};

// check if there is any 'ok' response from GRBL
export const isOKResponse = (data) => {
  const regex = /ok/;
  return regex.test(data);
};
