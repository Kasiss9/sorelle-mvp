import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import messagesRouter from "./messages";
import uploadsRouter from "./uploads";
import savedRouter from "./saved";
import usersRouter from "./users";
import adminRouter from "./admin";
import feedbackRouter from "./feedback";
const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(sessionsRouter);
router.use(messagesRouter);
router.use(uploadsRouter);
router.use(savedRouter);
router.use(feedbackRouter);
router.use(adminRouter);

export default router;
