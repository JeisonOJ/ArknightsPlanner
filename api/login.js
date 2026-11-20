import { authenticate } from "../server/auth.mjs";
export default (req, res) => authenticate(req, res, "login");
