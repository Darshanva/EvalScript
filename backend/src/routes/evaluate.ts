import { Router } from "express";
import multer from "multer";
import { evaluateWithGrok } from "../services/grokService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/evaluate",
  upload.fields([
    { name: "calibration", maxCount: 1 },
    { name: "pages", maxCount: 30 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as {
        calibration?: Express.Multer.File[];
        pages?: Express.Multer.File[];
      };

      if (!files.calibration || !files.pages) {
        return res.status(400).json({ error: "Calibration and pages are required" });
      }

      const calibrationBase64 = files.calibration[0].buffer.toString("base64");
      const answerPagesBase64 = files.pages.map((file) =>
        file.buffer.toString("base64")
      );

      // Temporary sample rubric (later database nunchi teesukovachu)
      const rubric = {
        exam_title: "Sample Exam",
        total_marks: 100,
        questions: [
          {
            question_number: 1,
            question_text: "Explain the concept",
            max_marks: 10,
            criteria: [
              { criterion: "Correct definition", marks: 4 },
              { criterion: "Example given", marks: 3 },
              { criterion: "Clarity", marks: 3 },
            ],
          },
        ],
      };

      const result = await evaluateWithGrok({
        calibrationBase64,
        answerPagesBase64,
        rubric,
      });

      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Evaluation failed" });
    }
  }
);

export default router;