import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import fileDownload from 'js-file-download';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
// import { TransitionGroup } from 'react-transition-group'; // ลบบรรทัดนี้ออก หรือคอมเมนต์ไว้

function App() {
  const [jobs, setJobs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [newJob, setNewJob] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // login | signup | reset
  const [errorMsg, setErrorMsg] = useState('');
  const [editingRemarkId, setEditingRemarkId] = useState(null);
  const [animatingJobId, setAnimatingJobId] = useState(null); // State สำหรับควบคุม Animation
  const jobRefs = useRef({}); // สร้าง ref สำหรับเก็บ DOM element ของแต่ละงาน

  // โหลด user ปัจจุบัน
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        setUser(null);
        // ลบ localStorage ที่เกี่ยวกับ supabase
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-'))
          .forEach((k) => localStorage.removeItem(k));
      } else {
        setUser(data.user);
      }
      setLoading(false);
    });
    supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      setJobs([]);
      setProfiles([]);
      setLoading(false);
      // ถ้า login สำเร็จและยังไม่มี profile ให้ insert profile
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        if (!profile && session.user.user_metadata?.user_name) {
          await supabase.from('profiles').insert([
            { user_id: session.user.id, username: session.user.user_metadata.user_name }
          ]);
        }
      }
      // force reload profiles ทุกครั้งหลัง login/logout
      const { data: newProfiles } = await supabase.from('profiles').select('*');
      setProfiles(newProfiles || []);
    });
  }, []);

  // โหลด jobs และ profiles จาก Supabase ทุกครั้งที่ user เปลี่ยน
  useEffect(() => {
    console.log('useEffect [user] called, user:', user);
    setLoading(true);
    console.log('setLoading(true) called in useEffect [user]');
    setErrorMsg('');

    const fetchData = async () => {
      try {
        // Get current session to ensure access token is valid
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        console.log('Session data:', sessionData);
        if (sessionError) throw sessionError;

        // Fetch profiles only if user is logged in
        if (user) {
          console.log('Attempting to fetch profiles...');
          const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*');
          console.log('Profiles fetch result:', { data: profilesData, error: profilesError });
          if (profilesError) throw profilesError;
          setProfiles(profilesData || []);
          console.log('profilesRes (inside then):', { data: profilesData, error: profilesError });

          // Existing profile debug logs
          console.log('user.id:', user.id);
          console.log('profiles:', profilesData);
          const found = (profilesData || []).find(
            (p) => String(p.user_id).trim().toLowerCase() === String(user.id).trim().toLowerCase()
          );
          console.log('profile found:', found);
        } else {
          setProfiles([]); // Clear profiles if no user
        }

        // Fetch jobs always
        console.log('Attempting to fetch jobs...');
        const { data: jobsData, error: jobsError } = await supabase.from('jobs')
          .select('*')
          .order('created_at', { ascending: true }); // ดึงมาตาม created_at ก่อน แล้วค่อยมาเรียง client-side
        console.log('Jobs fetch result:', { data: jobsData, error: jobsError });
        if (jobsError) throw jobsError;
        setJobs(sortJobs(jobsData) || []); // ใช้ sortJobs ตรงนี้
        console.log('jobsRes (inside then):', { data: jobsData, error: jobsError });

        // Debugging: Log type of job IDs
        if (jobsData && jobsData.length > 0) {
          console.log('First job ID and its type:', jobsData[0].id, typeof jobsData[0].id);
        }

      } catch (err) {
        setErrorMsg('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
        console.error('Fetch error details (inside catch):', err);
      } finally {
        setLoading(false);
        console.log('useEffect: jobs/profiles loaded, setLoading(false)');
      }
    };

    fetchData();

    // เพิ่ม event listener สำหรับ window focus เพื่อโหลดข้อมูลใหม่เมื่อแท็บกลับมาทำงาน
    window.addEventListener('focus', fetchData);

    // Cleanup function: ลบ event listener เมื่อ component unmount
    return () => {
      window.removeEventListener('focus', fetchData);
    };
  }, [user]);

  // คำนวณเปอร์เซ็นต์สำเร็จ (ถ้าไม่มีงานเลย ให้แสดง 100%)
  const totalJobs = jobs.length;
  const doneCount = jobs.filter(job => job.status === 'เสร็จแล้ว').length;
  const percent = totalJobs === 0 ? 100 : Math.round((doneCount / totalJobs) * 100);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = (percent / 100) * circumference;

  // Auth Modal UI (state แยกใน modal)
  const AuthModal = ({ show, mode, onClose, onSwitchMode }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rePassword, setRePassword] = useState('');
    const [userName, setUserName] = useState('');
    const [authError, setAuthError] = useState('');
    const [authMsg, setAuthMsg] = useState('');

    useEffect(() => {
      setEmail('');
      setPassword('');
      setRePassword('');
      setUserName('');
      setAuthError('');
      setAuthMsg('');
    }, [mode, show]);

    // หลังสมัครสมาชิกสำเร็จ เด้งไปหน้าเข้าสู่ระบบอัตโนมัติ
    useEffect(() => {
      if (mode === 'signup' && authMsg) {
        const timer = setTimeout(() => {
          onSwitchMode('login');
        }, 2000);
        return () => clearTimeout(timer);
      }
    }, [authMsg, mode, onSwitchMode]);

    const handleLogin = async (e) => {
      e.preventDefault();
      setAuthError(''); setAuthMsg('');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
      else onClose();
    };
    const handleSignup = async (e) => {
      e.preventDefault();
      setAuthError(''); setAuthMsg('');
      if (password !== rePassword) {
        setAuthError('รหัสผ่านไม่ตรงกัน');
        return;
      }
      if (!userName.trim()) {
        setAuthError('กรุณากรอกชื่อผู้ใช้');
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { user_name: userName }
        }
      });
      if (error) setAuthError(error.message);
      else setAuthMsg('กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน');
    };
    const handleReset = async (e) => {
      e.preventDefault();
      setAuthError(''); setAuthMsg('');
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setAuthError(error.message);
      else setAuthMsg('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว');
    };

    return (
      <div
        className="modal-backdrop"
        style={{ display: show ? 'flex' : 'none' }}
      >
        <div className="modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>×</button>
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <h2>เข้าสู่ระบบ</h2>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              <button type="submit">เข้าสู่ระบบ</button>
              <div className="modal-link">
                <span onClick={() => onSwitchMode('signup')}>สมัครสมาชิก</span> |
                <span onClick={() => onSwitchMode('reset')}>ลืมรหัสผ่าน?</span>
              </div>
              {authError && <div className="modal-error">{authError}</div>}
            </form>
          )}
          {mode === 'signup' && (
            <form onSubmit={handleSignup}>
              <h2 style={{ textAlign: 'center' }}>สมัครสมาชิก</h2>
              <input type="text" placeholder="ชื่อผู้ใช้ (User name)" value={userName} onChange={e => setUserName(e.target.value)} required />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
              <input type="password" placeholder="Confirm Password" value={rePassword} onChange={e => setRePassword(e.target.value)} required autoComplete="new-password" />
              <button type="submit">สมัครสมาชิก</button>
              <div className="modal-link">
                <span onClick={() => onSwitchMode('login')}>เข้าสู่ระบบ</span>
              </div>
              {authMsg && <div className="modal-success">{authMsg}</div>}
              {authError && <div className="modal-error">{authError}</div>}
            </form>
          )}
          {mode === 'reset' && (
            <form onSubmit={handleReset}>
              <h2>รีเซ็ตรหัสผ่าน</h2>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
              <button type="submit">ส่งลิงก์รีเซ็ตรหัสผ่าน</button>
              <div className="modal-link">
                <span onClick={() => onSwitchMode('login')}>เข้าสู่ระบบ</span>
              </div>
              {authMsg && <div className="modal-success">{authMsg}</div>}
              {authError && <div className="modal-error">{authError}</div>}
            </form>
          )}
        </div>
      </div>
    );
  };

  // ดึง user_name จาก profiles มาแสดงแทน email (debug ละเอียด)
  const getDisplayName = () => {
    if (!user) return '';
    const profile = profiles.find((p) => String(p.user_id).trim().toLowerCase() === String(user.id).trim().toLowerCase());
    // ถ้าไม่พบโปรไฟล์ ให้แสดง email แทน
    return profile ? profile.username : user.email;
  };

  // ฟังก์ชัน map user_id เป็น username
  const getUsernameById = (userId) => {
    const profile = profiles.find((p) => String(p.user_id).trim().toLowerCase() === String(userId).trim().toLowerCase());
    // หา user จาก auth ถ้าไม่มี profile
    if (profile) return profile.username;
    if (user && String(user.id).trim().toLowerCase() === String(userId).trim().toLowerCase()) return user.email;
    return '-';
  };

  const formatDateToYYMMDD = (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${year.slice(2)}/${month}/${day}`;
  };

  const formatDateTimeForCSV = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // ฟังก์ชันจัดเรียงงานตามความสำคัญ
  const sortJobs = (jobsArray) => {
    return [...jobsArray].sort((a, b) => {
      const isACompleted = a.status === 'เสร็จแล้ว';
      const isBCompleted = b.status === 'เสร็จแล้ว';

      // 1. งานที่ยังไม่เสร็จสิ้น จะอยู่ก่อนงานที่เสร็จสิ้นแล้ว
      if (isACompleted && !isBCompleted) return 1;
      if (!isACompleted && isBCompleted) return -1;

      // ถ้าสถานะเหมือนกัน (ทั้งคู่เสร็จแล้ว หรือทั้งคู่ยังไม่เสร็จ)
      if (!isACompleted && !isBCompleted) { // ทั้งคู่ยังไม่เสร็จ
        // เรียงตาม due_date (น้อยไปมาก, null อยู่ท้าย)
        const dateA = a.due_date ? new Date(a.due_date) : new Date('9999-12-31'); // กำหนดวันที่ไกลมากสำหรับ null
        const dateB = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');

        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;

        // ถ้า due_date เท่ากัน หรือทั้งคู่ไม่มี ให้เรียงตาม assigned_date (น้อยไปมาก)
        const assignedAtA = new Date(a.assigned_date);
        const assignedAtB = new Date(b.assigned_date);
        if (assignedAtA < assignedAtB) return -1;
        if (assignedAtA > assignedAtB) return 1;

      } else if (isACompleted && isBCompleted) { // ทั้งคู่เสร็จแล้ว
        // เรียงตาม completed_date (มากไปน้อย - ล่าสุดก่อน, null อยู่ท้าย)
        const completedAtA = a.completed_date ? new Date(a.completed_date) : new Date('0000-01-01'); // กำหนดวันที่อดีตมากสำหรับ null
        const completedAtB = b.completed_date ? new Date(b.completed_date) : new Date('0000-01-01');

        if (completedAtA > completedAtB) return -1;
        if (completedAtA < completedAtB) return 1;

        // ถ้า completed_date เท่ากัน หรือทั้งคู่ไม่มี ให้เรียงตาม assigned_date (น้อยไปมาก)
        const assignedAtA = new Date(a.assigned_date);
        const assignedAtB = new Date(b.assigned_date);
        if (assignedAtA < assignedAtB) return -1;
        if (assignedAtA > assignedAtB) return 1;
      }
      return 0;
    });
  };

  // ฟังก์ชันลบงาน
  const handleDeleteJob = async (id) => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบ');
      return;
    }
    console.log('พยายามลบงาน id:', id);
    const { error } = await supabase.from('jobs').delete().eq('id', id); // แก้ไขกลับ ไม่ต้องแปลงเป็น string
    if (!error) {
      const { data: jobsData, error: jobsError } = await supabase.from('jobs')
        .select('*')
        .order('created_at', { ascending: true }); // ดึงมาตาม created_at ก่อน แล้วค่อยมาเรียง client-side
      if (!jobsError) {
        setJobs(sortJobs(jobsData) || []); // ใช้ sortJobs ตรงนี้
      } else {
        alert('เกิดข้อผิดพลาดในการโหลดงานใหม่: ' + jobsError.message);
        console.error('Reload jobs error:', jobsError);
      }
    } else {
      alert('เกิดข้อผิดพลาดในการลบงาน: ' + error.message);
      console.error('Delete job error:', error);
    }
  };

  // ฟังก์ชันเพิ่มงาน
  const handleAddJob = async () => {
    if (!user) return;

    const newJobTitle = newJob.trim();
    const newJobAssignee = newAssignedTo.trim();
    const newJobDueDate = newDueDate.trim();

    if (newJobTitle) {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          title: newJobTitle,
          assigned_to: newJobAssignee,
          user_id: user.id,
          assigned_date: new Date().toISOString().slice(0, 10),
          status: 'ดำเนินการอยู่',
          due_date: newJobDueDate || null,
        })
        .select();

      if (!error) {
        console.log('Job added successfully:', data);
        // ดึงงานทั้งหมดมาใหม่พร้อมจัดเรียงด้วย sortJobs
        const { data: jobsData, error: jobsError } = await supabase.from('jobs')
          .select('*')
          .order('created_at', { ascending: true }); // ดึงมาตาม created_at ก่อน แล้วค่อยมาเรียง client-side
        if (!jobsError) {
          setJobs(sortJobs(jobsData) || []); // ใช้ sortJobs ตรงนี้
        } else {
          alert('เกิดข้อผิดพลาดในการโหลดงานใหม่: ' + jobsError.message);
        }
        setNewJob('');
        setNewAssignedTo('');
        setNewDueDate(''); // เคลียร์ค่าวันที่คาดว่าจะเสร็จ
      } else {
        alert('เกิดข้อผิดพลาดในการเพิ่มงาน: ' + error.message);
        console.error('Error adding job:', error);
      }
      setLoading(false); // ปิด loading หลังจากเสร็จสิ้น
    }
  };

  // ฟังก์ชันสำหรับเปลี่ยนสถานะ
  const handleStatusChange = async (jobId, newStatus, completedDate) => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบเพื่อเปลี่ยนสถานะ');
      return;
    }

    console.log(`Attempting to update job ${jobId} to status: ${newStatus}, completed_date: ${completedDate}`);
    const { data: updatedJob, error } = await supabase
      .from('jobs')
      .update({ status: newStatus, completed_date: completedDate })
      .eq('id', jobId) // แก้ไขกลับ ไม่ต้องแปลงเป็น string
      .select(); // เพิ่ม .select() ที่นี่เพื่อให้ได้ข้อมูลที่อัปเดตกลับมา

    if (error) {
      console.error('Error updating status to Supabase:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: ' + error.message);
      return; // Exit if update fails
    }

    console.log(`Supabase update successful for job ${jobId}. Data:`, updatedJob);

      if (newStatus === 'เสร็จแล้ว') {
        // อัปเดตสถานะใน local state ก่อนเพื่อเริ่ม Animation
        setJobs(jobs.map(j => j.id === jobId ? { ...j, status: newStatus, completed_date: completedDate } : j));
        setAnimatingJobId(jobId); // เริ่ม Animation fade-out
        
        // ส่งการอัปเดตไปยัง Supabase (ไม่ต้องรอผล) 
        // ไม่ต้อง await ตรงนี้ เพื่อไม่ให้ block UI และให้ Animation ทำงานก่อน
      // โค้ดส่วนนี้ถูกลบออก เนื่องจากมีการอัปเดตสถานะไปแล้วที่ด้านบน (บรรทัด 389-392)
      // supabase
      //   .from('jobs')
      //   .update({ status: newStatus, completed_date: completedDate })
      //   .eq('id', jobId);

        setTimeout(async () => {
          if (updatedJob && updatedJob.length > 0) {
            // ใช้ข้อมูลที่อัปเดตแล้วจาก Supabase โดยตรง ไม่ต้อง re-fetch ทั้งหมด
            const newJobsState = jobs.map(j => j.id === updatedJob[0].id ? updatedJob[0] : j);
            setJobs(sortJobs(newJobsState) || []); // ใช้ sortJobs ตรงนี้
            console.log('Jobs state updated for "เสร็จแล้ว" status with updated job data.');

            // เลื่อนไปยัง job ที่เสร็จแล้วหลังจากโหลดและจัดเรียงใหม่
            if (jobRefs.current[jobId]) {
              jobRefs.current[jobId].scrollIntoView({
                behavior: 'smooth',
                block: 'end'
              });
            }
          } else {
            // Fallback: If updatedJob is null/empty (shouldn't happen with .select()), re-fetch
            console.warn('Updated job data was null or empty after .select(). Re-fetching all jobs.');
          const { data: jobsData, error: jobsError } = await supabase.from('jobs')
            .select('*')
              .order('created_at', { ascending: true });
          if (!jobsError) {
              setJobs(sortJobs(jobsData) || []);
              console.log('Jobs state updated for "เสร็จแล้ว" status with sorted data (full reload).');
              if (jobRefs.current[jobId]) {
                jobRefs.current[jobId].scrollIntoView({
                  behavior: 'smooth',
                  block: 'end'
                });
              }
          } else {
            alert('เกิดข้อผิดพลาดในการโหลดงานใหม่หลังจากเปลี่ยนสถานะ (หลัง Animation): ' + jobsError.message);
            console.error('Error fetching jobs after status update (post-animation):', jobsError);
            }
          }
          setAnimatingJobId(null); // ลบ animatingJobId ออกเมื่อ Animation เสร็จสิ้น
        }, 500); // หน่วงเวลา 500ms ให้ตรงกับ CSS transition
      } else {
        // หากเปลี่ยนสถานะอื่นที่ไม่ใช่ 'เสร็จแล้ว' ให้รีโหลดและจัดเรียงทันที
        // และยังคงส่งอัปเดตไป Supabase โดยไม่ใช้ setTimeout
        // ไม่ต้องอัปเดตซ้ำ เพราะได้ await ด้านบนแล้ว

        // ใช้ updatedJob ที่ได้จาก Supabase มาอัปเดต local state โดยตรง
        if (updatedJob && updatedJob.length > 0) {
          setJobs(sortJobs(jobs.map(j => j.id === updatedJob[0].id ? updatedJob[0] : j)) || []);
          console.log('Jobs state updated for non-"เสร็จแล้ว" status with updated job data.');
        } else {
          // หากไม่มีข้อมูลจาก updatedJob (เช่น update ไม่พบ id) ให้ reload ทั้งหมด
          console.log('Fetching all jobs because updatedJob was empty or null for non-"เสร็จแล้ว" status update...');
          const { data: jobsData, error: jobsError } = await supabase.from('jobs')
            .select('*')
            .order('created_at', { ascending: true }); 
          if (!jobsError) {
            setJobs(sortJobs(jobsData) || []);
            console.log('Jobs state updated for non-"เสร็จแล้ว" status with sorted data (full reload).');
          } else {
            alert('เกิดข้อผิดพลาดในการโหลดงานใหม่หลังจากเปลี่ยนสถานะ: ' + jobsError.message);
            console.error('Error fetching jobs after status update:', jobsError);
          }
        }
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
      alert('เกิดข้อผิดพลาดในการออกจากระบบ: ' + error.message);
    } else {
      setUser(null);
      setJobs([]);
      setProfiles([]);
      setLoading(false);
      console.log('Logged out successfully.');
    }
  };

  const handleEditRemark = (jobId, currentRemark) => {
    setEditingRemarkId(jobId);
    setNewRemark(currentRemark || ''); // กำหนดค่า input ด้วยข้อความเดิม
  };

  const handleSaveRemark = async (jobId, newRemarkContent) => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบก่อนบันทึก Remark');
      return;
    }
    setLoading(true);
    const { data: updatedJob, error } = await supabase
      .from('jobs')
      .update({ remark: newRemarkContent })
      .eq('id', jobId)
      .select();
    setLoading(false);

    if (!error) {
      // หลังจากบันทึก Remark สำเร็จ ให้ดึงงานทั้งหมดมาใหม่แล้วจัดเรียง
      const { data: jobsData, error: jobsError } = await supabase.from('jobs')
        .select('*')
        .order('created_at', { ascending: true }); // ดึงมาตาม created_at ก่อน แล้วค่อยมาเรียง client-side
      if (!jobsError) {
        setJobs(sortJobs(jobsData) || []); // ใช้ sortJobs ตรงนี้
      } else {
        alert('เกิดข้อผิดพลาดในการโหลดงานใหม่หลังจากบันทึก Remark: ' + jobsError.message);
        console.error('Error fetching jobs after remark update:', jobsError);
      }
      setEditingRemarkId(null);
      setNewRemark('');
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึก Remark: ' + error.message);
      console.error('Error saving remark:', error);
    }
  };

  const handleExport = async () => {
    // กรองเฉพาะงานที่สถานะ "เสร็จแล้ว"
    const completedJobs = jobs.filter(job => job.status === 'เสร็จแล้ว');
    if (completedJobs.length === 0) {
      alert('ไม่มีงานที่เสร็จแล้วสำหรับการส่งออก');
      return;
    }
    // เตรียมข้อมูลสำหรับ Excel
    const headers = [
      "ลำดับ", "เนื้อหางาน", "ผู้รับผิดชอบ", "วันที่ได้รับงาน", "วันที่คาดการ", "วันที่เสร็จ", "หมายเหตุ", "สถานะ", "วันที่สร้าง", "วันที่อัปเดต"
    ];
    const data = completedJobs.map((job, index) => [
      index + 1,
      job.title || '',
      job.assigned_to || '',
      formatDateToYYMMDD(job.assigned_date) || '',
      formatDateToYYMMDD(job.due_date) || '',
      job.completed_date ? formatDateToYYMMDD(job.completed_date) : '-',
      job.remark || '',
      job.status || '',
      formatDateTimeForCSV(job.created_at),
      formatDateTimeForCSV(job.updated_at)
    ]);
    // สร้าง worksheet และ workbook
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CompletedJobs');
    // สร้างไฟล์ Excel และดาวน์โหลด
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'CompletedJobs.xlsx');

    // Popup ถามว่าต้องการลบงานที่เสร็จแล้วหรือไม่
    if (window.confirm('ต้องการลบงานที่เสร็จแล้วหรือไม่?')) {
      // ลบงานที่เสร็จแล้วทั้งหมด
      const completedIds = completedJobs.map(job => job.id);
      if (completedIds.length > 0) {
        const { error } = await supabase.from('jobs').delete().in('id', completedIds);
        if (!error) {
          // อัปเดต state jobs ในหน้าเว็บ
          setJobs(jobs.filter(job => job.status !== 'เสร็จแล้ว'));
        } else {
          alert('เกิดข้อผิดพลาดในการลบงานที่เสร็จแล้ว: ' + error.message);
        }
      }
    }
  };

  return (
    <div className="App">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 10 }}>
        {user ? (
          <>
            <span style={{ marginRight: 8 }}>เข้าสู่ระบบ: {getDisplayName()}</span>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <button onClick={() => { setShowAuthModal(true); setAuthMode('login'); }}>ล็อกอิน</button>
        )}
      </div>
      {errorMsg && <div style={{ color: 'red', textAlign: 'center' }}>{errorMsg}</div>}
      <AuthModal show={showAuthModal} mode={authMode} onClose={() => setShowAuthModal(false)} onSwitchMode={setAuthMode} />
      <h1>Coilmaster Electronics - Weekly Job Dashboard</h1>
      <div className="add-job">
        <textarea // เปลี่ยนจาก input เป็น textarea
          rows="3" // กำหนดความสูงเริ่มต้น
          placeholder="หัวข้อใหม่" // ย้าย placeholder มาที่นี่
          value={newJob}
          onChange={(e) => setNewJob(e.target.value)}
          disabled={!user}
          style={{ width: '100%', minHeight: '60px', boxSizing: 'border-box', resize: 'vertical' }} // เพิ่ม style
        />
        <input
          type="text"
          placeholder="ผู้รับผิดชอบ"
          value={newAssignedTo}
          onChange={(e) => setNewAssignedTo(e.target.value)}
          disabled={!user}
        />
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          placeholder="วันที่ครบกำหนด"
          disabled={!user}
        />
        <button onClick={handleAddJob} disabled={!user}>เพิ่มหัวข้อ</button>
        <button onClick={handleExport} className="export-button">Export</button>
      </div>

      {loading && <p>Loading jobs...</p>}

      <div style={{ overflowX: 'auto' }}>
        <table className="job-table">
          <colgroup>
            <col style={{ width: '5%' }} />{/* ลำดับ */}
            <col style={{ width: '23%' }} />{/* เนื้อหางาน - ปรับลด */}
            <col style={{ width: '10%' }} />{/* ผู้รับผิดชอบ */}
            <col style={{ width: '10%' }} />{/* วันที่ได้รับงาน */}
            <col style={{ width: '10%' }} />{/* วันที่คาดการ */}
            <col style={{ width: '10%' }} />{/* วันที่เสร็จ */}
            <col style={{ width: '15%' }} />{/* หมายเหตุ */}
            <col style={{ width: '10%' }} />{/* สถานะ - ปรับเพิ่ม */}
            <col style={{ width: '9%' }} />{/* ดำเนินการ - ปรับเพิ่ม */}
          </colgroup>
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>เนื้อหางาน</th>
              <th>ผู้รับผิดชอบ</th>
              <th>วันที่ได้รับงาน</th>
              <th>วันที่คาดการ</th>
              <th>วันที่เสร็จ</th>
              <th>หมายเหตุ</th>
              <th>สถานะ</th>
              <th>ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, index) => {
              return (
                <tr
                  key={job.id}
                  className={job.id === animatingJobId && job.status === 'เสร็จแล้ว' ? 'job-completed-fade-out' : ''}
                  ref={el => (jobRefs.current[job.id] = el)} // กำหนด ref ให้กับแต่ละแถว
                >
                  <td>{index + 1}</td>
                  <td dangerouslySetInnerHTML={{ __html: job.title.replace(/\n/g, '<br/>') }} />
                  <td>{job.assigned_to || '-'}</td>
                  <td>{formatDateToYYMMDD(job.assigned_date)}</td>
                  <td>{formatDateToYYMMDD(job.due_date)}</td>
                  <td>{formatDateToYYMMDD(job.completed_date)}</td>
                  <td style={{ color: job.remark ? '#333' : '#aaa' }}>
                    {editingRemarkId === job.id ? (
                      <textarea
                        rows="3"
                        value={newRemark}
                        onChange={(e) => setNewRemark(e.target.value)}
                        onBlur={() => handleSaveRemark(job.id, newRemark)}
                        autoFocus
                        style={{ width: '100%', minHeight: '60px', boxSizing: 'border-box' }}
                      />
                    ) : (
                      <span
                        onClick={() => handleEditRemark(job.id, job.remark)}
                        dangerouslySetInnerHTML={{ __html: (job.remark || 'Add').replace(/\n/g, '<br/>') }}
                      />
                    )}
                  </td>
                  <td>
                    <select
                      value={job.status}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        const newCompletedDate = newStatus === 'เสร็จแล้ว' ? new Date().toISOString().split('T')[0] : null;
                        handleStatusChange(job.id, newStatus, newCompletedDate);
                      }}
                      disabled={!user}
                      className={!user ? 'disabled-select' : ''}
                    >
                      <option value="ดำเนินการอยู่">ดำเนินการ</option>
                      <option value="รออนุมัติ">รออนุมัติ</option>
                      <option value="เลื่อน">เลื่อน</option>
                      <option value="เสร็จแล้ว">เสร็จแล้ว</option>
                    </select>
                  </td>
                  <td>
                    {job.status === 'เสร็จแล้ว' ? (
                      <button className="button-delete" onClick={() => handleDeleteJob(job.id)}>
                        ลบ
                      </button>
                    ) : (
                      <button className="button-on-process" disabled={true}>
                        On process
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pie-chart">
        <svg width="200" height="200" viewBox="0 0 40 40">
          <circle r="16" cx="20" cy="20" fill="#eee" />
          <circle
            r="16"
            cx="20"
            cy="20"
            fill="transparent"
            stroke="#4caf50"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s' }}
          />
          <text x="20" y="24" textAnchor="middle" fontSize="8" fill="#333">{percent}%</text>
        </svg>
        <div>งานสำเร็จ {doneCount} จาก {jobs.length} หัวข้อ</div>
      </div>
    </div>
  );
}

export default App;
