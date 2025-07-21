
import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import fileDownload from 'js-file-download';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { motion } from 'framer-motion';
// import { TransitionGroup } from 'react-transition-group'; // ลบบรรทัดนี้ออก หรือคอมเมนต์ไว้

// import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; // ลบบรรทัดนี้ออก

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
  const [editingDueDateId, setEditingDueDateId] = useState(null);
  const [newDueDateValue, setNewDueDateValue] = useState('');
  const [oldDueDates, setOldDueDates] = useState({}); // { jobId: [oldDueDate1, oldDueDate2, ...] }
  const [draggingOverIndex, setDraggingOverIndex] = useState(null);


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
      // setJobs([]); // ลบบรรทัดนี้ออก
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
        // เปลี่ยนจาก .select('*') เป็น .select('*, due_date_history')
        const { data: jobsData, error: jobsError } = await supabase.from('jobs')
          .select('*, due_date_history')
          .order('order', { ascending: true })
          .order('due_date', { ascending: true });
        console.log('Jobs fetch result:', { data: jobsData, error: jobsError });
        if (jobsError) throw jobsError;
        setJobs(sortJobs(jobsData || [])); // ใช้ sortJobs ตรงนี้
        console.log('jobsRes (inside then):', { data: jobsData, error: jobsError });

        // Debugging: Log type of job IDs
        if (jobsData && jobsData.length > 0) {
          console.log('First job ID and its type:', jobsData[0].id, typeof jobsData[0].id);
        }

        // ใน useEffect ที่ fetch jobs (หลัง setJobs)
        console.log('Jobs fetch result:', { data: jobsData, error: jobsError });
        if (jobsData && jobsData.length > 0) {
          console.log('ตัวอย่าง job:', jobsData[0]);
        }
        const oldDueDatesObj = {};
        (jobsData || []).forEach(job => {
          oldDueDatesObj[job.id] = Array.isArray(job.due_date_history) ? job.due_date_history : [];
        });
        console.log('oldDueDatesObj:', oldDueDatesObj);
        setOldDueDates(oldDueDatesObj);

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
    // --- เพิ่มเติม: โหลด email/password จาก localStorage ---
    const [email, setEmail] = useState(() => localStorage.getItem('savedEmail') || '');
    const [password, setPassword] = useState(() => localStorage.getItem('savedPassword') || '');
    const [rePassword, setRePassword] = useState('');
    const [userName, setUserName] = useState('');
    const [authError, setAuthError] = useState('');
    const [authMsg, setAuthMsg] = useState('');

    useEffect(() => {
      // --- reset เฉพาะ signup/reset ---
      if (mode === 'signup' || mode === 'reset') {
        setEmail('');
        setPassword('');
      } else if (mode === 'login' && show) {
        // โหลด email/password จาก localStorage เฉพาะ login
        setEmail(localStorage.getItem('savedEmail') || '');
        setPassword(localStorage.getItem('savedPassword') || '');
      }
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
      else {
        // --- save email/password ลง localStorage เฉพาะเครื่องนี้ ---
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('savedPassword', password);
        onClose();
      }
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

  // ฟังก์ชันสำหรับแสดงและแก้ไขหมายเหตุ
  const renderRemarkCell = (job, gapStyle) => {
    if (editingRemarkId === job.id) {
      return (
        <textarea
          rows="3"
          value={newRemark}
          onChange={(e) => setNewRemark(e.target.value)}
          onBlur={() => handleSaveRemark(job.id, newRemark)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleSaveRemark(job.id, newRemark);
            } else if (e.key === 'Escape') {
              setEditingRemarkId(null);
              setNewRemark('');
            }
          }}
          autoFocus
          style={{ width: '100%', minHeight: '60px', boxSizing: 'border-box' }}
          placeholder="พิมพ์หมายเหตุที่นี่..."
        />
      );
    }

    return (
      <span
        onClick={() => handleEditRemark(job.id, job.remark)}
        dangerouslySetInnerHTML={{ __html: (job.remark || 'Add').replace(/\n/g, '<br/>') }}
        title="คลิกเพื่อแก้ไขหมายเหตุ"
        style={{ 
          cursor: 'pointer',
          display: 'block',
          padding: '4px',
          borderRadius: '4px',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = '#f0f8ff';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
        }}
      />
    );
  };

  // ฟังก์ชันสำหรับแสดงและแก้ไขวันที่คาดการณ์
  const renderDueDateCell = (job, gapStyle) => {
    if (editingDueDateId === job.id) {
      return (
        <input
          type="date"
          value={newDueDateValue}
          onChange={e => setNewDueDateValue(e.target.value)}
          onBlur={() => {
            if (newDueDateValue && newDueDateValue !== job.due_date) {
              handleSaveDueDate(job.id, newDueDateValue);
            } else {
              setEditingDueDateId(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (newDueDateValue && newDueDateValue !== job.due_date) {
                handleSaveDueDate(job.id, newDueDateValue);
              } else {
                setEditingDueDateId(null);
              }
            } else if (e.key === 'Escape') {
              setEditingDueDateId(null);
              setNewDueDateValue('');
            }
          }}
          autoFocus
          className="due-date-editable"
          disabled={job.status === 'เสร็จแล้ว' || !user}
        />
      );
    }

    return (
      <div 
        className={`due-date-editable ${job.status !== 'เสร็จแล้ว' ? 'editable' : ''}`}
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '100%',
          cursor: job.status !== 'เสร็จแล้ว' ? 'pointer' : 'default',
          padding: '4px',
          borderRadius: '4px',
          transition: 'background-color 0.2s'
        }}
        onClick={() => {
          if (job.status !== 'เสร็จแล้ว') {
            setEditingDueDateId(job.id);
            setNewDueDateValue(job.due_date || '');
          }
        }}
        title={job.status !== 'เสร็จแล้ว' ? 'คลิกเพื่อแก้ไขวันที่' : ''}
      >
        {(() => {
          console.log(`Checking history for job ${job.id}:`, oldDueDates[job.id]);
          return oldDueDates[job.id] && oldDueDates[job.id].length > 0;
        })() && (
          <div className="due-date-history">
            {console.log(`Rendering history for job ${job.id}:`, oldDueDates[job.id])}
            {oldDueDates[job.id].slice(0, 3).map((oldDate, index) => (
              <div
                key={index}
                className="due-date-history-item"
                style={{
                  textDecoration: 'line-through',
                  opacity: 0.6 - (index * 0.1),
                  color: '#666',
                  fontSize: '0.8em',
                  marginBottom: '2px'
                }}
                title={`วันที่เดิม: ${formatDateToYYMMDD(oldDate)}`}
              >
                {formatDateToYYMMDD(oldDate)}
              </div>
            ))}
            {oldDueDates[job.id].length > 3 && (
              <div 
                className="due-date-history-item"
                style={{ 
                  opacity: 0.4,
                  fontSize: '0.7em',
                  fontStyle: 'italic'
                }}
                title={`และอีก ${oldDueDates[job.id].length - 3} วันที่`}
              >
                +{oldDueDates[job.id].length - 3} วันที่
              </div>
            )}
          </div>
        )}
        <div className="date-content">
          <span>{formatDateToYYMMDD(job.due_date)}</span>
          {job.status !== 'เสร็จแล้ว' && user && (
            <span className="edit-icon">✎</span>
          )}
        </div>
      </div>
    );
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

  // ฟังก์ชันจัดเรียงงาน: 1) ยังไม่เสร็จ+มี due_date (วันใกล้สุดก่อน), 2) ยังไม่เสร็จ+ไม่มี due_date, 3) เสร็จแล้ว (ล่างสุด)
  const sortJobs = (jobsArray) => {
    console.log('sortJobs called with:', jobsArray.length, 'jobs');
    const sorted = [...jobsArray].sort((a, b) => {
      const isACompleted = a.status === 'เสร็จแล้ว';
      const isBCompleted = b.status === 'เสร็จแล้ว';
      
      // งานที่เสร็จแล้วให้อยู่ล่างสุด
      if (isACompleted && !isBCompleted) return 1;
      if (!isACompleted && isBCompleted) return -1;
      
      // ทั้งคู่ยังไม่เสร็จ
      if (!isACompleted && !isBCompleted) {
        const hasDueA = !!a.due_date;
        const hasDueB = !!b.due_date;
        
        // กลุ่ม 1: ทั้งคู่มี due_date → เรียงวันใกล้สุดไปไกลสุด
        if (hasDueA && hasDueB) {
          const dateA = new Date(a.due_date);
          const dateB = new Date(b.due_date);
          if (dateA < dateB) return -1;
          if (dateA > dateB) return 1;
        }
        
        // กลุ่ม 1 กับ 2: มี due_date อยู่บน, ไม่มี due_date อยู่ล่าง
        if (hasDueA && !hasDueB) return -1;
        if (!hasDueA && hasDueB) return 1;
        
        // กลุ่ม 2: ทั้งคู่ไม่มี due_date → เรียงตามวันที่สร้าง (ใหม่สุดอยู่บน)
        return new Date(b.created_at) - new Date(a.created_at);
      }
      
      // ทั้งคู่เสร็จแล้ว → เรียงตามวันที่เสร็จ (ใหม่สุดอยู่ล่าง)
      if (isACompleted && isBCompleted) {
        const dateA = a.completed_date ? new Date(a.completed_date) : new Date(a.updated_at);
        const dateB = b.completed_date ? new Date(b.completed_date) : new Date(b.updated_at);
        return dateB - dateA; // ใหม่สุดอยู่ล่าง
      }
      
      return 0;
    });
    
    console.log('Sorted jobs - Completed at bottom:', sorted.filter(j => j.status === 'เสร็จแล้ว').length);
    return sorted;
  };

  // ฟังก์ชันลบงาน
  const handleDeleteJob = async (id) => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบ');
      return;
    }
    console.log('พยายามลบงาน id:', id);
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (!error) {
      const { data: jobsData, error: jobsError } = await supabase.from('jobs')
        .select('*')
        .order('order', { ascending: true })
        .order('due_date', { ascending: true });
      if (!jobsError) {
        setJobs(sortJobs(jobsData || []));
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
          due_date_history: [] // เพิ่มบรรทัดนี้
        })
        .select();

      // ดึง jobs ทั้งหมดมาใหม่ (ไม่ใช้ jobs เดิมใน state)
      const { data: jobsData, error: jobsError } = await supabase.from('jobs')
        .select('*')
        .order('order', { ascending: true })
        .order('due_date', { ascending: true });
      if (!error && !jobsError) {
        setJobs(sortJobs(jobsData || []));
        localStorage.removeItem('jobsOrder'); // ลบ jobsOrder เดิมเพื่อไม่ให้ override ลำดับใหม่
        setNewJob('');
        setNewAssignedTo('');
        setNewDueDate('');
      } else {
        alert('เกิดข้อผิดพลาดในการเพิ่มงาน: ' + (error?.message || jobsError?.message));
        console.error('Error adding job:', error, jobsError);
      }
      setLoading(false);
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
      .eq('id', jobId)
      .select();

    if (error) {
      console.error('Error updating status to Supabase:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: ' + error.message);
      return; // Exit if update fails
    }

    console.log(`Supabase update successful for job ${jobId}. Data:`, updatedJob);

    if (newStatus === 'เสร็จแล้ว') {
      // อัปเดตสถานะใน local state ก่อนเพื่อเริ่ม Animation
      const updatedJobs = jobs.map(j => j.id === jobId ? { ...j, status: newStatus, completed_date: completedDate } : j);
      setJobs(sortJobs(updatedJobs)); // จัดเรียงทันทีให้งานที่เสร็จแล้วเด้งไปล่าง
      setAnimatingJobId(jobId); // เริ่ม Animation fade-out
      
      // ลบการสไลด์หน้าจอออก
      setTimeout(() => {
        setAnimatingJobId(null); // ลบ animatingJobId ออกเมื่อ Animation เสร็จสิ้น
      }, 300); // ลดเวลาเป็น 300ms เพื่อให้เร็วขึ้น
    } else {
      // หากเปลี่ยนสถานะอื่นที่ไม่ใช่ 'เสร็จแล้ว' ให้รีโหลดและจัดเรียงทันที
      const { data: jobsData, error: jobsError } = await supabase.from('jobs')
        .select('*')
        .order('order', { ascending: true })
        .order('due_date', { ascending: true }); 
      if (!jobsError) {
        setJobs(sortJobs(jobsData) || []);
        console.log('Jobs state updated for non-"เสร็จแล้ว" status with sorted data (full reload).');
      } else {
        alert('เกิดข้อผิดพลาดในการโหลดงานใหม่หลังจากเปลี่ยนสถานะ: ' + jobsError.message);
        console.error('Error fetching jobs after status update:', jobsError);
      }
    }
  };

  // ฟังก์ชันบันทึก due_date ใหม่
  const handleSaveDueDate = async (jobId, newDate) => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบเพื่อแก้ไขวันที่คาดการณ์');
      return;
    }
    console.log(`=== handleSaveDueDate called ===`);
    console.log(`Job ID: ${jobId}`);
    console.log(`New Date: ${newDate}`);
    
    const currentJob = jobs.find(j => j.id === jobId);
    const currentDueDate = currentJob?.due_date;
    console.log(`Current Due Date: ${currentDueDate}`);
    
    // เก็บประวัติการแก้ไขวันที่ (วันที่เก่าจะถูกดันขึ้นไปด้านบน)
    let newHistory = oldDueDates[jobId] || [];
    if (currentDueDate && currentDueDate.trim() !== '' && currentDueDate !== newDate) {
      newHistory = [...newHistory, currentDueDate];
    }
    setOldDueDates(prev => {
      const existingHistory = prev[jobId] || [];
      if (currentDueDate && currentDueDate.trim() !== '' && currentDueDate !== newDate) {
        return { ...prev, [jobId]: [...existingHistory, currentDueDate] };
      }
      return { ...prev, [jobId]: existingHistory };
    });
    
    // อัปเดต jobs ใน state และจัดเรียงใหม่
    const updatedJobs = jobs.map(j => j.id === jobId ? { ...j, due_date: newDate } : j);
    setJobs(sortJobs(updatedJobs));
    setEditingDueDateId(null);
    setNewDueDateValue('');
    
    // ถ้าล็อกอินแล้ว ให้บันทึกลง Supabase
    if (user) {
      setLoading(true);
      // เพิ่ม log ตรงนี้
      console.log('จะอัปเดต Supabase:', {
        jobId,
        due_date: newDate,
        due_date_history: newHistory
      });
      const { data: updatedJob, error } = await supabase
        .from('jobs')
        .update({ 
          due_date: newDate,
          due_date_history: newHistory
        })
        .eq('id', jobId)
        .select();
      // เพิ่ม log ตรงนี้
      console.log('Supabase update result:', { data: updatedJob, error });
      setLoading(false);
      
      if (error) {
        alert('เกิดข้อผิดพลาดในการอัปเดตวันที่คาดการณ์');
        console.error('Error updating due date:', error);
      }
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
      alert('เกิดข้อผิดพลาดในการออกจากระบบ: ' + error.message);
    } else {
      window.location.reload(); // รีเฟรชหน้าเว็บทันที
      return; // ไม่ต้อง setUser/setProfiles/setLoading ต่อ
      // setUser(null);
      // setProfiles([]);
      // setLoading(false);
      // console.log('Logged out successfully.');
    }
  };

  const handleEditRemark = (jobId, currentRemark) => {
    // ไม่ต้องตรวจสอบ user แล้ว ให้แก้ไขได้เลย
    setEditingRemarkId(jobId);
    setNewRemark(currentRemark || ''); // กำหนดค่า input ด้วยข้อความเดิม
  };

  const handleSaveRemark = async (jobId, newRemarkContent) => {
    setLoading(true);
    
    // ถ้าไม่ล็อกอิน ให้อัปเดตเฉพาะใน local state
    if (!user) {
      const updatedJobs = jobs.map(j => j.id === jobId ? { ...j, remark: newRemarkContent } : j);
      setJobs(updatedJobs);
      setEditingRemarkId(null);
      setNewRemark('');
      setLoading(false);
      return;
    }
    
    // ถ้าล็อกอินแล้ว ให้บันทึกลง Supabase
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
        .order('order', { ascending: true })
        .order('due_date', { ascending: true }); // ดึงมาตาม created_at ก่อน แล้วค่อยมาเรียง client-side
      if (!jobsError) {
        setJobs(sortJobs(jobsData || [])); // ใช้ sortJobs ตรงนี้
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
          const remainingJobs = jobs.filter(job => job.status !== 'เสร็จแล้ว');
          setJobs(sortJobs(remainingJobs));
        } else {
          alert('เกิดข้อผิดพลาดในการลบงานที่เสร็จแล้ว: ' + error.message);
        }
      }
    }
  };

  // เพิ่มฟังก์ชัน handleDragEnd (บันทึกลำดับใหม่ลง localStorage)
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(jobs);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    // อัปเดต order ใน state ทันที
    setJobs(sortJobs(reordered));
    // อัปเดต order ใน Supabase
    await Promise.all(
      reordered.map((job, idx) =>
        supabase.from('jobs').update({ order: idx }).eq('id', job.id)
      )
    );
    // save order to localStorage (optional, fallback)
    localStorage.setItem('jobsOrder', JSON.stringify(reordered.map(j => j.id)));
  };

  // useEffect โหลด jobsOrder จาก localStorage ถ้ามี
  useEffect(() => {
    const order = localStorage.getItem('jobsOrder');
    if (order && jobs.length > 0) {
      // ถ้า jobsOrder ไม่ตรงกับ jobs ปัจจุบัน (จำนวนหรือ id ไม่ตรง) ให้ข้าม ไม่ต้อง override
      const idOrder = JSON.parse(order);
      const jobsIds = jobs.map(j => j.id);
      const isSame = idOrder.length === jobsIds.length && idOrder.every(id => jobsIds.includes(id));
      if (!isSame) return;
      // เรียง jobs ตาม idOrder, jobs ที่ไม่มีใน order จะต่อท้าย
      const jobsMap = Object.fromEntries(jobs.map(j => [j.id, j]));
      const ordered = idOrder.map(id => jobsMap[id]).filter(Boolean);
      const rest = jobs.filter(j => !idOrder.includes(j.id));
      setJobs(sortJobs([...ordered, ...rest]));
    }
    // eslint-disable-next-line
  }, [jobs.length]);

  // ล้างประวัติการแก้ไขวันที่เมื่อโหลดหน้าใหม่
  useEffect(() => {
    // setOldDueDates({}); // ลบบรรทัดนี้ออก
  }, [user]);

  // Debug: แสดงประวัติการแก้ไขวันที่
  useEffect(() => {
    console.log('Current oldDueDates:', oldDueDates);
    console.log('oldDueDates keys:', Object.keys(oldDueDates));
    Object.keys(oldDueDates).forEach(key => {
      console.log(`Job ${key} history:`, oldDueDates[key]);
    });
  }, [oldDueDates]);

  // หลังจากเพิ่ม/ลบ/เปลี่ยน jobs ให้บันทึกลำดับใหม่ลง localStorage
  useEffect(() => {
    if (jobs.length > 0) {
      localStorage.setItem('jobsOrder', JSON.stringify(jobs.map(j => j.id)));
    }
  }, [jobs]);

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
        <button 
          onClick={handleAddJob} 
          disabled={!user}
          className={!user ? 'add-job-disabled' : 'add-job-active'}
        >เพิ่มหัวข้อ</button>
        <button onClick={handleExport} className="export-button">Export</button>
      </div>

      {/* Loading jobs message */}
      {loading && jobs.length === 0 && (
        <div style={{ color: '#888', marginBottom: 8 }}>Loading jobs...</div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="job-table job-table-animated">
          <colgroup>
            <col style={{ width: '5%' }} />{/* ลำดับ */}
            <col style={{ width: '22%' }} />{/* เนื้อหางาน - ปรับลด */}
            <col style={{ width: '10%' }} />{/* ผู้รับผิดชอบ */}
            <col style={{ width: '10%' }} />{/* วันที่ได้รับงาน */}
            <col style={{ width: '12%' }} />{/* วันที่คาดการ - เพิ่มความกว้าง */}
            <col style={{ width: '10%' }} />{/* วันที่เสร็จ */}
            <col style={{ width: '15%' }} />{/* หมายเหตุ */}
            <col style={{ width: '10%' }} />{/* สถานะ */}
            <col style={{ width: '8%' }} />{/* ดำเนินการ - ปรับลด */}
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
          <tbody
            style={{
              background: draggingOverIndex !== null ? '#e3f2fd' : undefined,
              transition: 'background 0.2s',
              position: 'relative'
            }}
          >
            {jobs.map((job, index) => {
              // หาตำแหน่ง drop gap
              let gapStyle = {};
              if (draggingOverIndex !== null && draggingOverIndex === index) {
                gapStyle = { paddingTop: 24, transition: 'padding 0.2s' };
              }
              return (
                <React.Fragment key={job.id}>
                  {/* ลบตัวแปร isDropGap และการใช้งานออก (ไม่มีในโค้ดนี้แล้ว) */}
                  {job.due_date ? (
                    <motion.tr
                      key={job.id}
                      ref={el => (jobRefs.current[job.id] = el)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.4, type: 'spring', stiffness: 60 }}
                      className={`job-row ${job.status === 'เสร็จแล้ว' ? 'completed' : ''} ${job.id === animatingJobId && job.status === 'เสร็จแล้ว' ? 'job-completed-fade-out newly-completed' : ''}`}
                      style={gapStyle}
                    >
                      <td style={gapStyle}>{index + 1}</td>
                      <td style={gapStyle} dangerouslySetInnerHTML={{ __html: job.title.replace(/\n/g, '<br/>') }} />
                      <td style={gapStyle}>{job.assigned_to || '-'}</td>
                      <td style={gapStyle}>{formatDateToYYMMDD(job.assigned_date)}</td>
                      <td style={gapStyle}>
                        {renderDueDateCell(job, gapStyle)}
                      </td>
                      <td style={gapStyle}>{formatDateToYYMMDD(job.completed_date)}</td>
                      <td style={{ ...gapStyle, color: job.remark ? '#333' : '#aaa' }}>
                        {renderRemarkCell(job, gapStyle)}
                      </td>
                      <td style={gapStyle}>
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
                      <td style={gapStyle}>
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
                    </motion.tr>
                  ) : (
                    <tr key={job.id} className={`job-row ${job.status === 'เสร็จแล้ว' ? 'completed' : ''}`} style={gapStyle}>
                      <td style={gapStyle}>{index + 1}</td>
                      <td style={gapStyle} dangerouslySetInnerHTML={{ __html: job.title.replace(/\n/g, '<br/>') }} />
                      <td style={gapStyle}>{job.assigned_to || '-'}</td>
                      <td style={gapStyle}>{formatDateToYYMMDD(job.assigned_date)}</td>
                      <td style={gapStyle}>
                        {renderDueDateCell(job, gapStyle)}
                      </td>
                      <td style={gapStyle}>{formatDateToYYMMDD(job.completed_date)}</td>
                      <td style={{ ...gapStyle, color: job.remark ? '#333' : '#aaa' }}>
                        {renderRemarkCell(job, gapStyle)}
                      </td>
                      <td style={gapStyle}>
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
                      <td style={gapStyle}>
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
                  )}
                </React.Fragment>
              );
            })}
            {draggingOverIndex !== null && (
              <tr style={{ height: 0 }}>
                <td colSpan={10} style={{ padding: 0 }}>
                  <div style={{ height: 4, background: '#1976d2', borderRadius: 2, margin: 0, opacity: 0.5, transition: 'opacity 0.2s' }} />
                </td>
              </tr>
            )}
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
