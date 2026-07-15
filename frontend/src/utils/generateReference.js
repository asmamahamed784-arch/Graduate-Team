// src/utils/generateReference.js
// Generates a formatted booking reference like NQS-1023

export const generateReference = () => {
  const min = 1000;
  const max = 9999;
  const number = Math.floor(Math.random() * (max - min + 1)) + min;
  return `NQS-${number}`;
};
