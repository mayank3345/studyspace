import { Router } from 'express';
import multer from 'multer';
import { uploadLimits } from '../config/limits.js';
import { checkStudyAnswer, createStudyItems, listStudyItems } from '../controllers/study.controller.js';
import { deleteDocument, getPdf, listDocuments, uploadDocument } from '../controllers/documents.controller.js';
import { requireSession } from '../middleware/session-auth.middleware.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadLimits.maxPdfBytes, files: 1 },
});

router.get('/', requireSession, listDocuments);
router.post('/', requireSession, upload.single('pdf'), uploadDocument);
router.get('/:id/file', requireSession, getPdf);
router.get('/:id/study-items', requireSession, listStudyItems);
router.post('/:id/study-items', requireSession, createStudyItems);
router.post('/:id/study-items/:itemId/check', requireSession, checkStudyAnswer);
router.delete('/:id', requireSession, deleteDocument);

export default router;
