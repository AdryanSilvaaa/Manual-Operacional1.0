/** Encaminha rejeições de controllers assíncronos ao tratador de erros de app.js. */
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
