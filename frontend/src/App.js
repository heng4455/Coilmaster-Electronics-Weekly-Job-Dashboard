import React, { useState, useEffect } from 'react';
import './App.css';
import { supabase } from './supabaseClient';

function App() {
  const [jobs, setJobs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [newJob, setNewJob] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [newEstimatedCompletionDate, setNewEstimatedCompletionDate] = useState(''); // เพิ่ม state ใหม่สำหรับวันที่คาดว่าจะเสร็จ
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // login | signup | reset
  const [errorMsg, setErrorMsg] = useState('');
  const [editingRemarkId, setEditingRemarkId] = useState(null);
  const [editingRemarkContent, setEditingRemarkContent] = useState('');

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

        // Fetch jobs always
        console.log('Attempting to fetch jobs...');
        const { data: jobsData, error: jobsError } = await supabase.from('jobs').select('*').order('created_at', { ascending: true });
        console.log('Jobs fetch result:', { data: jobsData, error: jobsError });
        if (jobsError) throw jobsError;
        setJobs(jobsData || []);
        console.log('jobsRes (inside then):', { data: jobsData, error: jobsError });

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

  // ฟังก์ชันลบงาน
  const handleDeleteJob = async (id) => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบ');
      return;
    }
    console.log('พยายามลบงาน id:', id);
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (!error) {
      const { data: jobsData, error: jobsError } = await supabase.from('jobs').select('*').order('created_at', { ascending: true });
      if (!jobsError) {
        setJobs(jobsData || []);
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
    const newJobAssignee = newRemark.trim(); // ใช้ newRemark เป็น Assignee
    const newJobEstimatedCompletionDate = newEstimatedCompletionDate.trim(); // ใช้ newEstimatedCompletionDate เป็น estimated_completion_date

    if (newJobTitle) {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          title: newJobTitle,
          assignee: newJobAssignee,
          user_id: user.id, // กำหนด user_id ของงานเป็น id ของ user ที่ login
          assigned_date: new Date().toISOString().slice(0, 10), // เพิ่ม assigned_date
          status: 'ดำเนินการอยู่', // ตั้งสถานะเริ่มต้นเป็น 'ดำเนินการอยู่'
          estimated_completion_date: newJobEstimatedCompletionDate || null, // เพิ่ม estimated_completion_date
        })
        .select();
      if (error) throw error;
      setJobs([...jobs, data[0]]);
      setNewJob('');
      setNewRemark(''); // ล้างช่อง assignee ด้วย
      setNewEstimatedCompletionDate(''); // ล้างช่อง estimated_completion_date ด้วย
    }
  };

  // ฟังก์ชันสำหรับเปลี่ยนสถานะ
  const handleStatusChange = async (jobId, newStatus) => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบเพื่อเปลี่ยนสถานะ');
      return;
    }

    const completedDate = newStatus === 'เสร็จแล้ว' ? new Date().toISOString().slice(0, 10) : null;

    const { data, error } = await supabase
      .from('jobs')
      .update({ status: newStatus, completed_date: completedDate })
      .eq('id', jobId);

    if (!error) {
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status: newStatus, completed_date: completedDate } : j));
    } else {
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: ' + error.message);
      console.error('Error updating status:', error);
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
    setEditingRemarkContent(currentRemark || '');
  };

  const handleSaveRemark = async (jobId, newRemarkContent) => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบเพื่อแก้ไขหมายเหตุ');
      return;
    }
    setEditingRemarkId(null); // ปิดโหมดแก้ไข
    const { error } = await supabase
      .from('jobs')
      .update({ remark: newRemarkContent })
      .eq('id', jobId);

    if (error) {
      alert('เกิดข้อผิดพลาดในการบันทึกหมายเหตุ: ' + error.message);
      console.error('Error saving remark:', error);
    } else {
      // รีโหลด jobs เพื่อแสดงข้อมูลล่าสุด
      const { data: jobsData, error: jobsError } = await supabase.from('jobs').select('*').order('created_at', { ascending: true });
      if (!jobsError) {
        setJobs(jobsData || []);
      } else {
        alert('เกิดข้อผิดพลาดในการโหลดงานหลังบันทึกหมายเหตุ: ' + jobsError.message);
        console.error('Reload jobs after remark save error:', jobsError);
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
        <textarea
          placeholder="หัวข้อใหม่"
          value={newJob}
          onChange={e => setNewJob(e.target.value)}
          rows={2}
          style={{ resize: 'vertical', minWidth: '180px', maxWidth: '300px' }}
          disabled={!user}
        />
        <input
          type="text"
          placeholder="ผู้รับผิดชอบ"
          value={newRemark}
          onChange={e => setNewRemark(e.target.value)}
          disabled={!user}
        />
        <input // เพิ่มช่องกรอกวันที่คาดว่าจะเสร็จ
          type="date"
          placeholder="วันที่คาดว่าจะเสร็จ"
          value={newEstimatedCompletionDate}
          onChange={e => setNewEstimatedCompletionDate(e.target.value)}
          disabled={!user}
        />
        <button onClick={handleAddJob} disabled={!user}>เพิ่มหัวข้อ</button>
      </div>
      {loading ? (
        <div>กำลังโหลดข้อมูล...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>เนื้อหางาน</th>
                <th>ผู้รับผิดชอบ</th>
                <th>วันที่ได้รับงาน</th>
                <th>วันที่คาดว่าจะเสร็จ</th>
                <th>วันที่เสร็จ</th>
                <th>สถานะ</th>
                <th>หมายเหตุ</th>
                <th>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => (
                <tr key={job.id}>
                  <td>{idx + 1}</td>
                  <td dangerouslySetInnerHTML={{ __html: job.title.replace(/\n/g, '<br/>') }} />
                  <td>{job.assignee || '-'}</td>
                  <td>{job.assigned_date || '-'}</td>
                  <td>{job.estimated_completion_date || '-'}</td>
                  <td>{job.completed_date || '-'}</td>
                  <td>
                    <select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job.id, e.target.value)}
                      disabled={!user}
                      className={!user ? 'disabled-select' : ''}
                    >
                      <option value="ดำเนินการอยู่">ดำเนินการอยู่</option>
                      <option value="รออนุมัติ">รออนุมัติ</option>
                      <option value="เลื่อน">เลื่อน</option>
                      <option value="เสร็จแล้ว">เสร็จแล้ว</option>
                    </select>
                  </td>
                  <td>
                    {editingRemarkId === job.id ? (
                      <input
                        type="text"
                        value={editingRemarkContent}
                        onChange={(e) => setEditingRemarkContent(e.target.value)}
                        onBlur={() => handleSaveRemark(job.id, editingRemarkContent)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveRemark(job.id, editingRemarkContent);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => user && handleEditRemark(job.id, job.remark)} style={{ cursor: user ? 'pointer' : 'default' }}>{job.remark || '-'}</span>
                    )}
                  </td>
                  <td>
                    {job.status !== 'เสร็จแล้ว' ? (
                      <button
                        onClick={async () => {
                          if (!user) return;
                          const completedDate = new Date().toISOString().slice(0, 10);
                          const { data, error } = await supabase
                            .from('jobs')
                            .update({ status: 'เสร็จแล้ว', completed_date: completedDate })
                            .eq('id', job.id);
                          console.log('Complete clicked', { data, error });
                          if (!error && data) {
                            setJobs(jobs.map(j => j.id === job.id ? { ...j, status: 'เสร็จแล้ว', completed_date: completedDate } : j));
                          } else if (error) {
                            console.error('Complete job error:', error);
                          }
                        }}
                        disabled={!user}
                        className={job.status !== 'เสร็จแล้ว' ? 'button-on-process' : ''}
                      >
                        {job.status !== 'เสร็จแล้ว' ? 'On process' : 'Complete'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        disabled={!user}
                      >
                        ลบ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
