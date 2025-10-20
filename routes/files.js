const express = require('express');

const router = express.Router();
const { requireAnyRole } = require('../middleware/auth');
const { getMeta, getFileStream } = require('../services/fileStore');

// RBAC: docs.print | Admin
router.use(requireAnyRole(['docs.print', 'Admin']));

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const meta = getMeta(id);
  if (!meta) return res.status(404).json({ error: 'NOT_FOUND' });
  const stream = await getFileStream(id);
  if (!stream) return res.status(404).json({ error: 'NOT_FOUND' });
  res.setHeader('Content-Type', meta.mime);
  res.setHeader('Content-Length', String(meta.size));
  res.setHeader('Content-Disposition', `attachment; filename="${meta.name}"`);
  stream.pipe(res);
});

module.exports = router;