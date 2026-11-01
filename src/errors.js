'use strict';
class ApiError extends Error {
  constructor(message, status = 502, code) {
    super(message); this.status = status; this.code = code;
  }
}
module.exports = { ApiError };
