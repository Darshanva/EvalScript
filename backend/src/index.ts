import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import evaluateRouter from "./routes/evaluate";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api", evaluateRouter);

app.get("/", (req, res) => {
  res.json({ message: "EvalScript Backend is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});