export const validate = (schema) => (req, res, next) => {
  const toValidate = {};
  if (Object.keys(req.body || {}).length) toValidate.body = req.body;
  if (Object.keys(req.query || {}).length) toValidate.query = req.query;
  if (Object.keys(req.params || {}).length) toValidate.params = req.params;

  const { error, value } = schema.validate(toValidate, {
    allowUnknown: true,
    abortEarly: false,
  });
  if (error) {
    error.status = 400;
    return next(error);
  }
  req.valid = value; // išsaugome validuotus duomenis
  next();
};
