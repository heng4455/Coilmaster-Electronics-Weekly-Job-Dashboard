const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// mockup job data
let jobs = [
  { id: 1, title: 'ตรวจสอบเครื่องจักร', remark: 'สมชาย', done: true },
  { id: 2, title: 'จัดซื้อวัตถุดิบ', remark: 'วิไล', done: false },
  { id: 3, title: 'ส่งรายงานลูกค้า', remark: 'อนันต์', done: false },
];

// GET jobs
app.get('/api/jobs', (req, res) => {
  res.json(jobs);
});

// POST job
app.post('/api/jobs', (req, res) => {
  const { title, remark } = req.body;
  if (!title || !remark) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  const newJob = { id: jobs.length + 1, title, remark, done: false };
  jobs.push(newJob);
  res.json(newJob);
});

// PUT toggle job done
app.put('/api/jobs/:id/toggle', (req, res) => {
  const id = parseInt(req.params.id);
  const job = jobs.find(j => j.id === id);
  if (!job) return res.status(404).json({ error: 'ไม่พบงานนี้' });
  job.done = !job.done;
  res.json(job);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 