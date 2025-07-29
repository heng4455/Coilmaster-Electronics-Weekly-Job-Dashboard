
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
  const [selectedPeople, setSelectedPeople] = useState([]); // For multiple selection
  const [newDueDate, setNewDueDate] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingRemarkId, setEditingRemarkId] = useState(null);
  const [animatingJobId, setAnimatingJobId] = useState(null); // State สำหรับควบคุม Animation
  const [editingDueDateId, setEditingDueDateId] = useState(null);
  const [newDueDateValue, setNewDueDateValue] = useState('');
  const [oldDueDates, setOldDueDates] = useState({}); // { jobId: [oldDueDate1, oldDueDate2, ...] }
  
  // ระบบ auth ใหม่ - เรียบง่าย
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');
  const [isSignupMode, setIsSignupMode] = useState(false); // สำหรับสลับโหมดใน modal เดียวกัน
  const [showUserMenu, setShowUserMenu] = useState(false); // สำหรับแสดง user menu modal

  const jobRefs = useRef({}); // สร้าง ref สำหรับเก็บ DOM element ของแต่ละงาน


  // ระบบ auth ใหม่ - เรียบง่าย
  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing auth...');
        
        // ตรวจสอบ session ปัจจุบันก่อน
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          if (mounted) {
            setIsLoggedIn(false);
            setCurrentUser(null);
            setLoading(false);
          }
          return;
        }
        
        console.log('📋 Initial session check:', session?.user?.email || 'No session');
        
        if (mounted) {
          if (session?.user) {
            setIsLoggedIn(true);
            setCurrentUser(session.user);
            console.log('✅ User session restored:', session.user.email);
          } else {
            setIsLoggedIn(false);
            setCurrentUser(null);
            console.log('⚠️ No active session found');
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) {
          setIsLoggedIn(false);
          setCurrentUser(null);
          setLoading(false);
        }
      }
    };
    
    // เริ่มต้น auth
    initializeAuth();
    
    // ฟัง auth state changes เพื่อตรวจสอบ session อัตโนมัติ
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email);
        
        if (!mounted) return;
        
        if (event === 'SIGNED_IN' && session?.user) {
          setIsLoggedIn(true);
          setCurrentUser(session.user);
          setShowLoginModal(false);
          setIsSignupMode(false);
          console.log('✅ User signed in:', session.user.email);
        } else if (event === 'SIGNED_OUT') {
          setIsLoggedIn(false);
          setCurrentUser(null);
          setProfiles([]);
          console.log('🚪 User signed out');
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setIsLoggedIn(true);
          setCurrentUser(session.user);
          console.log('🔄 Token refreshed for:', session.user.email);
        } else if (event === 'INITIAL_SESSION' && session?.user) {
          setIsLoggedIn(true);
          setCurrentUser(session.user);
          console.log('🎯 Initial session detected:', session.user.email);
        }
      }
    );

    // Cleanup subscription เมื่อ component unmount
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ฟังก์ชันล็อกอิน
  const handleLogin = async (email, password) => {
    try {
      setLoginError('');
      console.log('🔐 Login attempt with:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      console.log('🔐 Login response:', { data, error });

      if (error) {
        console.error('❌ Login error:', error);
        setLoginError(error.message);
        return false;
      }

      if (data.user) {
        // ล้างฟอร์ม
        setLoginEmail('');
        setLoginPassword('');
        setLoginError('');
        console.log('✅ Login successful:', data.user.email);
        // ไม่ต้องเรียก loadData() เพราะ auth state listener จะจัดการให้
        return true;
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setLoginError('เกิดข้อผิดพลาดในการล็อกอิน');
      return false;
    }
  };

  // ฟังก์ชันล็อกเอาท์
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      
      setIsLoggedIn(false);
      setCurrentUser(null);
      setProfiles([]);
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // ฟังก์ชันสมัครสมาชิก
  const handleSignup = async (email, password, confirmPassword, name) => {
    try {
      setSignupError('');
      setSignupSuccess('');

      if (password !== confirmPassword) {
        setSignupError('รหัสผ่านไม่ตรงกัน');
        return false;
      }

      if (!name.trim()) {
        setSignupError('กรุณากรอกชื่อผู้ใช้');
        return false;
      }

      console.log('Signup attempt with:', email, name);

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { user_name: name }
        }
      });

      console.log('Signup response:', { data, error });

      if (error) {
        console.error('Signup error:', error);
        setSignupError(error.message);
        return false;
      }

      setSignupSuccess('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน');
      // ล้างฟอร์ม
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirmPassword('');
      setSignupName('');
      
      // ปิด modal และรีเซ็ตโหมดหลัง 3 วินาที
      setTimeout(() => {
        setShowLoginModal(false);
        setIsSignupMode(false);
        setSignupSuccess('');
      }, 3000);
      
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      setSignupError('เกิดข้อผิดพลาดในการสมัครสมาชิก');
      return false;
    }
  };

  // โหลดข้อมูล jobs และ profiles
  useEffect(() => {
    if (!loading) {
      loadData();
    }
  }, [loading, isLoggedIn]); // เพิ่ม isLoggedIn เป็น dependency

  const loadData = async () => {
    try {
      setErrorMsg('กำลังโหลดข้อมูล...');
      
      // โหลด jobs ก่อน (ไม่ต้องล็อกอินก็ดูได้) - ไม่แสดงงานที่ถูกลบ
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*, due_date_history')
        .not('status', 'eq', 'ลบแล้ว') // ไม่แสดงงานที่ถูก soft delete
        .order('created_at', { ascending: true });
      
      if (jobsError) {
        console.error('Jobs error:', jobsError);
        setErrorMsg('ไม่สามารถโหลดข้อมูลงานได้');
      } else {
        setJobs(sortJobs(jobsData || []));
        
        // อัปเดต oldDueDates
        const oldDueDatesObj = {};
        (jobsData || []).forEach(job => {
          oldDueDatesObj[job.id] = Array.isArray(job.due_date_history) ? job.due_date_history : [];
        });
        setOldDueDates(oldDueDatesObj);
        
        console.log('Jobs loaded:', jobsData?.length || 0);
      }
      
      // โหลด profiles ถ้าล็อกอินแล้ว
      if (isLoggedIn) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*');
        
        if (profilesError) {
          console.error('Profiles error:', profilesError);
        } else {
          setProfiles(profilesData || []);
          console.log('Profiles loaded:', profilesData?.length || 0);
        }
      }
      
      setErrorMsg('');
    } catch (error) {
      console.error('Load data error:', error);
      setErrorMsg('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
  };

  // คำนวณเปอร์เซ็นต์สำเร็จ (ถ้าไม่มีงานเลย ให้แสดง 100%)
  const totalJobs = jobs.length;
  const doneCount = jobs.filter(job => job.status === 'เสร็จแล้ว').length;
  const percent = totalJobs === 0 ? 100 : Math.round((doneCount / totalJobs) * 100);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = (percent / 100) * circumference;

  // ฟังก์ชัน modal ล็อกอินแบบใหม่ - เรียบง่าย
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    await handleLogin(loginEmail, loginPassword);
  };

  const getDisplayName = () => {
    if (!currentUser) return '';
    const profile = profiles.find((p) => String(p.user_id).trim().toLowerCase() === String(currentUser.id).trim().toLowerCase());
    
    // ลำดับการแสดงชื่อ: 1) username จาก profile table, 2) user_name จาก auth metadata, 3) email
    if (profile && profile.username) {
      return profile.username;
    }
    
    // ตรวจสอบ user_name จาก auth metadata (จากตอนสมัครสมาชิก)
    if (currentUser.user_metadata && currentUser.user_metadata.user_name) {
      return currentUser.user_metadata.user_name;
    }
    
    // fallback เป็น email ถ้าไม่มีข้อมูลอื่น
    return currentUser.email;
  };

  // ฟังก์ชัน map user_id เป็น username
  const getUsernameById = (userId) => {
    const profile = profiles.find((p) => String(p.user_id).trim().toLowerCase() === String(userId).trim().toLowerCase());
    // หา currentUser จาก auth ถ้าไม่มี profile
    if (profile) return profile.username;
    if (currentUser && String(currentUser.id).trim().toLowerCase() === String(userId).trim().toLowerCase()) return currentUser.email;
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
          disabled={job.status === 'เสร็จแล้ว' || !currentUser}
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
          {job.status !== 'เสร็จแล้ว' && currentUser && (
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
        
        // กลุ่ม 2: ทั้งคู่ไม่มี due_date → เรียงตามวันที่สร้าง (เก่าสุดอยู่บน, ใหม่สุดอยู่ล่าง)
        return new Date(a.created_at) - new Date(b.created_at);
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
    console.log('🔴 handleDeleteJob called with id:', id);
    console.log('🔴 currentUser:', currentUser);
    
    if (!currentUser) {
      console.log('❌ No user logged in');
      alert('กรุณาเข้าสู่ระบบเพื่อลบงาน');
      return;
    }

    // หาข้อมูลงานที่จะลบ
    const jobToDelete = jobs.find(job => job.id === id);
    if (!jobToDelete) {
      alert('ไม่พบงานที่ต้องการลบ');
      return;
    }

    console.log('🔴 Job status:', jobToDelete.status);

    // ยืนยันการลบ
    const isCompleted = jobToDelete.status === 'เสร็จสิ้น';
    const confirmMessage = isCompleted 
      ? 'ต้องการลบงานที่เสร็จสิ้นแล้วออกจากระบบถาวรหรือไม่?' 
      : 'ต้องการลบงานนี้หรือไม่?';
    
    const confirmDelete = window.confirm(confirmMessage);
    console.log('🔴 User confirmed delete:', confirmDelete);
    if (!confirmDelete) {
      return;
    }

    try {
      console.log('🔴 พยายามลบงาน id:', id);
      
      // ตรวจสอบ session ปัจจุบัน
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('🔴 Current session:', sessionData?.session?.user?.email);
      
      let deleteSuccess = false;
      
      if (isCompleted) {
        // สำหรับงานที่เสร็จสิ้น: ลบจาก database จริงๆ (Hard Delete)
        console.log('🔴 งานเสร็จสิ้นแล้ว - ทำการลบถาวร (Hard Delete)...');
        const hardDeleteResponse = await supabase
          .from('jobs')
          .delete()
          .eq('id', id);
        
        console.log('🔴 Hard delete response:', hardDeleteResponse);
        
        if (hardDeleteResponse.error) {
          console.error('❌ Hard delete failed:', hardDeleteResponse.error);
          alert('ไม่สามารถลบงานได้: ' + hardDeleteResponse.error.message);
          return;
        }
        
        console.log('✅ ลบงานสำเร็จ (Hard Delete - ลบถาวร)');
        deleteSuccess = true;
        
      } else {
        // สำหรับงานที่ยังไม่เสร็จ: ใช้ Soft Delete (เปลี่ยนเฉพาะ status)
        console.log('🔴 งานยังไม่เสร็จ - ทำการ Soft Delete...');
        const softDeleteResponse = await supabase
          .from('jobs')
          .update({ 
            status: 'ลบแล้ว'
          })
          .eq('id', id);
        
        console.log('🔴 Soft delete response:', softDeleteResponse);
        
        if (softDeleteResponse.error) {
          console.error('❌ Soft delete failed:', softDeleteResponse.error);
          alert('ไม่สามารถลบงานได้: ' + softDeleteResponse.error.message);
          return;
        }
        
        console.log('✅ ลบงานสำเร็จ (Soft Delete)');
        deleteSuccess = true;
      }
      
      if (deleteSuccess) {
        // หลังจากลบสำเร็จ ให้อัปเดต UI
        const filteredJobs = jobs.filter(job => job.id !== id);
        setJobs(filteredJobs);
        console.log('🔴 Updated UI, showing', filteredJobs.length, 'jobs');
        
        // อัปเดต oldDueDates state หลังจากลบงาน
        const newOldDueDates = {...oldDueDates};
        delete newOldDueDates[id];
        setOldDueDates(newOldDueDates);
        
        const successMessage = isCompleted 
          ? 'ลบงานออกจากระบบถาวรแล้ว!' 
          : 'ลบงานสำเร็จ!';
        alert(successMessage);
      }
      
    } catch (err) {
      console.error('❌ Unexpected error in handleDeleteJob:', err);
      alert('เกิดข้อผิดพลาดที่ไม่คาดคิด: ' + err.message);
    }
  };

  // ฟังก์ชันเพิ่มงาน
  const handleAddJob = async () => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนเพิ่มงาน');
      return;
    }

    const newJobTitle = newJob.trim();
    const newJobAssignee = selectedPeople.length > 0 ? selectedPeople.join(', ') : '';
    const newJobDueDate = newDueDate.trim();

    if (!newJobTitle) {
      alert('กรุณากรอกหัวข้องาน');
      return;
    }

    console.log('Adding new job...');
    setOperationLoading(true);
    setErrorMsg('กำลังเพิ่มงานใหม่... ⏳');
    
    try {
      // เพิ่ม timeout สำหรับการเพิ่มงาน
      const insertPromise = supabase
        .from('jobs')
        .insert({
          title: newJobTitle,
          assigned_to: newJobAssignee,
          user_id: currentUser.id,
          assigned_date: new Date().toISOString().slice(0, 10),
          status: 'ดำเนินการอยู่',
          due_date: newJobDueDate || null,
          due_date_history: [] // เพิ่มบรรทัดนี้
        })
        .select();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('การเพิ่มงานใช้เวลานานเกินไป (timeout 15 วินาที)')), 15000);
      });

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      if (error) {
        throw new Error(error.message);
      }

      console.log('Job added successfully:', data);

      // ดึง jobs ทั้งหมดมาใหม่ (ไม่ใช้ jobs เดิมใน state) - กรองเฉพาะงานที่ไม่ถูกลบ
      const fetchJobsPromise = supabase.from('jobs')
        .select('*, due_date_history')
        .not('status', 'eq', 'ลบแล้ว') // ไม่แสดงงานที่ถูก soft delete
        .order('created_at', { ascending: true });

      const { data: jobsData, error: jobsError } = await Promise.race([
        fetchJobsPromise, 
        new Promise((_, reject) => setTimeout(() => reject(new Error('โหลดข้อมูลงานใช้เวลานานเกินไป')), 10000))
      ]);

      if (jobsError) {
        throw new Error('ไม่สามารถโหลดข้อมูลงานใหม่ได้: ' + jobsError.message);
      }

      // อัปเดต state และ cache
      setJobs(sortJobs(jobsData || []));
      
      // อัปเดต oldDueDates state หลังจากเพิ่มงานใหม่
      const oldDueDatesObj = {};
      (jobsData || []).forEach(job => {
        oldDueDatesObj[job.id] = Array.isArray(job.due_date_history) ? job.due_date_history : [];
      });
      setOldDueDates(oldDueDatesObj);
      
      // อัปเดต cache
      localStorage.setItem('cachedJobs', JSON.stringify(jobsData));
      localStorage.removeItem('jobsOrder'); // ลบ jobsOrder เดิมเพื่อไม่ให้ override ลำดับใหม่
      
      // ล้าง form
      setNewJob('');
      setSelectedPeople([]); // Clear selected people
      setNewDueDate('');
      
      setErrorMsg('เพิ่มงานใหม่สำเร็จ! ✅');
      setTimeout(() => setErrorMsg(''), 3000);

    } catch (err) {
      console.error('Add job error:', err);
      const errorMessage = err.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';
      alert('ไม่สามารถเพิ่มงานได้: ' + errorMessage);
      setErrorMsg('การเพิ่มงานล้มเหลว: ' + errorMessage);
    } finally {
      console.log('Setting operationLoading to false after add job');
      setOperationLoading(false);
    }
  };

  // ฟังก์ชันสำหรับเปลี่ยนสถานะ
  const handleStatusChange = async (jobId, newStatus, completedDate) => {
    if (!currentUser) {
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
        .select('*, due_date_history')
        .order('order', { ascending: true })
        .order('due_date', { ascending: true }); 
      if (!jobsError) {
        setJobs(sortJobs(jobsData) || []);
        // อัปเดต oldDueDates state หลังจากเปลี่ยนสถานะ
        const oldDueDatesObj = {};
        (jobsData || []).forEach(job => {
          oldDueDatesObj[job.id] = Array.isArray(job.due_date_history) ? job.due_date_history : [];
        });
        setOldDueDates(oldDueDatesObj);
        console.log('Jobs state updated for non-"เสร็จแล้ว" status with sorted data (full reload).');
      } else {
        alert('เกิดข้อผิดพลาดในการโหลดงานใหม่หลังจากเปลี่ยนสถานะ: ' + jobsError.message);
        console.error('Error fetching jobs after status update:', jobsError);
      }
    }
  };

  // ฟังก์ชันบันทึก due_date ใหม่
  const handleSaveDueDate = async (jobId, newDate) => {
    if (!currentUser) {
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
    if (currentUser) {
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

  const handleEditRemark = (jobId, currentRemark) => {
    // ไม่ต้องตรวจสอบ currentUser แล้ว ให้แก้ไขได้เลย
    setEditingRemarkId(jobId);
    setNewRemark(currentRemark || ''); // กำหนดค่า input ด้วยข้อความเดิม
  };

  const handleSaveRemark = async (jobId, newRemarkContent) => {
    setLoading(true);
    
    // ถ้าไม่ล็อกอิน ให้อัปเดตเฉพาะใน local state
    if (!currentUser) {
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
        .select('*, due_date_history')
        .order('order', { ascending: true })
        .order('due_date', { ascending: true }); // ดึงมาตาม created_at ก่อน แล้วค่อยมาเรียง client-side
      if (!jobsError) {
        setJobs(sortJobs(jobsData || [])); // ใช้ sortJobs ตรงนี้
        // อัปเดต oldDueDates state หลังจากบันทึก Remark
        const oldDueDatesObj = {};
        (jobsData || []).forEach(job => {
          oldDueDatesObj[job.id] = Array.isArray(job.due_date_history) ? job.due_date_history : [];
        });
        setOldDueDates(oldDueDatesObj);
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

  const handleCapture = async () => {
    try {
      // ใช้ html2canvas สำหรับแคปภาพตาราง
      const html2canvas = (await import('html2canvas')).default;
      const table = document.querySelector('.job-table');
      if (!table) {
        alert('ไม่พบตารางที่จะแคปภาพ');
        return;
      }
      
      const canvas = await html2canvas(table, {
        backgroundColor: '#ffffff',
        scale: 2, // ความละเอียดสูง
        useCORS: true
      });
      
      // แปลง canvas เป็น blob แล้วคัดลอกไปยัง clipboard
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          alert('คัดลอกภาพตารางไปยัง clipboard แล้ว! สามารถนำไปวางได้');
        } catch (clipboardError) {
          console.error('Error copying to clipboard:', clipboardError);
          alert('ไม่สามารถคัดลอกไปยัง clipboard ได้ กรุณาลองใหม่');
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      alert('เกิดข้อผิดพลาดในการแคปภาพ: ' + error.message);
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

    // ตรวจสอบการล็อกอินก่อนถามเรื่องการลบไฟล์
    if (!currentUser) {
      alert('ส่งออกไฟล์เสร็จแล้ว! (หากต้องการลบงานที่เสร็จแล้ว กรุณาเข้าสู่ระบบ)');
      return;
    }

    // Popup ถามว่าต้องการลบงานที่เสร็จแล้วหรือไม่ (เฉพาะผู้ที่ล็อกอินแล้ว)
    if (window.confirm('ต้องการลบงานที่เสร็จแล้วหรือไม่?')) {
      // ลบงานที่เสร็จแล้วทั้งหมด
      const completedIds = completedJobs.map(job => job.id);
      if (completedIds.length > 0) {
        const { error } = await supabase.from('jobs').delete().in('id', completedIds);
        if (!error) {
          // อัปเดต state jobs ในหน้าเว็บ
          const remainingJobs = jobs.filter(job => job.status !== 'เสร็จแล้ว');
          setJobs(sortJobs(remainingJobs));
          alert('ลบงานที่เสร็จแล้วเรียบร้อย!');
        } else {
          alert('เกิดข้อผิดพลาดในการลบงานที่เสร็จแล้ว: ' + error.message);
        }
      }
    }
  };

  // ฟังก์ชันสำหรับผู้ดูแลระบบ - ล้างงานที่ถูก soft delete
  const handleCleanupDeletedJobs = async () => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบเพื่อใช้ฟีเจอร์นี้');
      return;
    }

    const confirmCleanup = window.confirm(
      'ต้องการลบงานที่ถูกทำ soft delete ออกจาก database ถาวรหรือไม่?\n\n' +
      'การดำเนินการนี้ไม่สามารถย้อนกลับได้!'
    );

    if (!confirmCleanup) return;

    try {
      console.log('🧹 เริ่มล้างงานที่ถูก soft delete...');
      
      // ลบงานที่มี status = 'ลบแล้ว' ออกจาก database
      const { data, error } = await supabase
        .from('jobs')
        .delete()
        .eq('status', 'ลบแล้ว');

      if (error) {
        console.error('❌ Error cleaning up deleted jobs:', error);
        alert('เกิดข้อผิดพลาดในการล้างข้อมูล: ' + error.message);
        return;
      }

      console.log('✅ Cleanup successful');
      alert('ล้างงานที่ถูกลบออกจาก database แล้ว!');
      
    } catch (err) {
      console.error('❌ Unexpected error in cleanup:', err);
      alert('เกิดข้อผิดพลาดที่ไม่คาดคิด: ' + err.message);
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
  }, [currentUser]);

  // Debug: แสดงประวัติการแก้ไขวันที่
  useEffect(() => {
    console.log('=== oldDueDates Debug ===');
    console.log('Current oldDueDates:', oldDueDates);
    console.log('oldDueDates keys:', Object.keys(oldDueDates));
    console.log('Number of jobs:', jobs.length);
    console.log('Jobs with due_date_history:', jobs.filter(j => j.due_date_history && j.due_date_history.length > 0).length);
    
    Object.keys(oldDueDates).forEach(key => {
      console.log(`Job ${key} history:`, oldDueDates[key]);
    });
    
    // แสดงตัวอย่าง job data
    if (jobs.length > 0) {
      console.log('Sample job structure:', {
        id: jobs[0].id,
        title: jobs[0].title,
        due_date_history: jobs[0].due_date_history,
        hasHistory: !!jobs[0].due_date_history
      });
    }
  }, [oldDueDates, jobs]);

  // หลังจากเพิ่ม/ลบ/เปลี่ยน jobs ให้บันทึกลำดับใหม่ลง localStorage
  useEffect(() => {
    if (jobs.length > 0) {
      localStorage.setItem('jobsOrder', JSON.stringify(jobs.map(j => j.id)));
    }
  }, [jobs]);

  return (
    <div className="App">
      {/* แสดงสถานะการโหลดข้อมูล */}
      {(loading || operationLoading) && (
        <div style={{ 
          position: 'fixed', 
          top: '10px', 
          right: '10px', 
          background: '#007bff', 
          color: 'white', 
          padding: '8px 12px', 
          borderRadius: '4px',
          fontSize: '14px',
          zIndex: 1000
        }}>
          {loading ? 'กำลังตรวจสอบ session...' : 'กำลังดำเนินการ...'}
        </div>
      )}
      
      {/* แสดง error message */}
      {errorMsg && (
        <div style={{ 
          position: 'fixed', 
          top: '50px', 
          right: '10px', 
          background: '#dc3545', 
          color: 'white', 
          padding: '8px 12px', 
          borderRadius: '4px',
          fontSize: '14px',
          zIndex: 1000,
          maxWidth: '300px',
          wordWrap: 'break-word'
        }}>
          {errorMsg}
          <button 
            onClick={() => setErrorMsg('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              marginLeft: '8px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 10, gap: '8px' }}>
        {isLoggedIn ? (
          <>
            <span style={{ marginRight: 8 }}>{getDisplayName()}</span>
            <button 
              onClick={() => setShowUserMenu(true)}
              style={{ 
                background: '#6c757d', 
                color: 'white', 
                border: 'none', 
                padding: '4px 8px', 
                borderRadius: '4px',
                fontSize: '12px',
                marginLeft: '5px'
              }}
              title="เมนูผู้ใช้"
            >
              ⋯
            </button>
          </>
        ) : (
          <button 
            onClick={() => setShowLoginModal(true)}
            style={{
              background: 'linear-gradient(135deg, #007bff, #0056b3)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #0056b3, #004085)';
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #007bff, #0056b3)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.3)';
            }}
          >
            <span style={{ fontSize: '16px' }}>🔐</span>
            Login
          </button>
        )}
      </div>
      {errorMsg && <div style={{ color: 'red', textAlign: 'center' }}>{errorMsg}</div>}
      
      {/* Login/Signup Modal */}
      {showLoginModal && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => {
              setShowLoginModal(false);
              setIsSignupMode(false);
              setLoginError('');
              setSignupError('');
              setSignupSuccess('');
            }}>×</button>
            
            {!isSignupMode ? (
              /* Login Form */
              <form onSubmit={handleLoginSubmit}>
                <h2>เข้าสู่ระบบ</h2>
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={loginEmail} 
                  onChange={e => setLoginEmail(e.target.value)} 
                  required 
                  autoComplete="username"
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={loginPassword} 
                  onChange={e => setLoginPassword(e.target.value)} 
                  required 
                  autoComplete="current-password"
                />
                <button type="submit">เข้าสู่ระบบ</button>
                {loginError && <div className="modal-error">{loginError}</div>}
                
                <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                  <span style={{ color: '#666' }}>ยังไม่มีบัญชี? </span>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsSignupMode(true);
                      setLoginError('');
                    }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#007bff', 
                      textDecoration: 'underline', 
                      cursor: 'pointer' 
                    }}
                  >
                    สมัครสมาชิก
                  </button>
                </div>
              </form>
            ) : (
              /* Signup Form */
              <form onSubmit={async (e) => {
                e.preventDefault();
                await handleSignup(signupEmail, signupPassword, signupConfirmPassword, signupName);
              }}>
                <h2>สมัครสมาชิก</h2>
                <input 
                  type="text" 
                  placeholder="ชื่อผู้ใช้" 
                  value={signupName} 
                  onChange={e => setSignupName(e.target.value)} 
                  required 
                />
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={signupEmail} 
                  onChange={e => setSignupEmail(e.target.value)} 
                  required 
                  autoComplete="username"
                />
                <input 
                  type="password" 
                  placeholder="รหัสผ่าน" 
                  value={signupPassword} 
                  onChange={e => setSignupPassword(e.target.value)} 
                  required 
                  autoComplete="new-password"
                />
                <input 
                  type="password" 
                  placeholder="ยืนยันรหัสผ่าน" 
                  value={signupConfirmPassword} 
                  onChange={e => setSignupConfirmPassword(e.target.value)} 
                  required 
                  autoComplete="new-password"
                />
                <button type="submit">สมัครสมาชิก</button>
                {signupError && <div className="modal-error">{signupError}</div>}
                {signupSuccess && <div className="modal-success">{signupSuccess}</div>}
                
                <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                  <span style={{ color: '#666' }}>มีบัญชีแล้ว? </span>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsSignupMode(false);
                      setSignupError('');
                      setSignupSuccess('');
                    }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#007bff', 
                      textDecoration: 'underline', 
                      cursor: 'pointer' 
                    }}
                  >
                    เข้าสู่ระบบ
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      
      {/* User Menu Modal */}
      {showUserMenu && (
        <div className="modal-backdrop" onClick={() => setShowUserMenu(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: '280px' }}>
            <button className="modal-close" onClick={() => setShowUserMenu(false)}>×</button>
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ 
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #007bff, #0056b3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: 'bold'
                }}>
                  👤
                </div>
                <div style={{ color: '#6c757d', fontSize: '12px', fontWeight: '500' }}>
                  ผู้ใช้งาน
                </div>
              </div>
              
              <div style={{ 
                background: '#f8f9fa', 
                padding: '15px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                border: '1px solid #dee2e6',
                position: 'relative'
              }}>
                <div style={{ 
                  position: 'absolute',
                  top: '-8px',
                  left: '12px',
                  background: '#f8f9fa',
                  padding: '0 8px',
                  fontSize: '10px',
                  color: '#6c757d',
                  fontWeight: '500'
                }}>
                  USERNAME
                </div>
                <div style={{ 
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#333',
                  marginTop: '5px'
                }}>
                  {getDisplayName()}
                </div>
              </div>
              
              <button 
                onClick={() => {
                  setShowUserMenu(false);
                  handleCleanupDeletedJobs();
                }}
                style={{ 
                  background: '#ffc107', 
                  color: '#212529', 
                  border: 'none', 
                  padding: '10px 20px', 
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  width: '100%',
                  fontWeight: '500',
                  transition: 'background-color 0.2s',
                  marginBottom: '10px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e0a800';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#ffc107';
                }}
                title="ลบงานที่ถูก soft delete ออกจาก database ถาวร"
              >
                🧹 ล้างข้อมูลที่ถูกลบ
              </button>
              
              <button 
                onClick={() => {
                  handleLogout();
                  setShowUserMenu(false);
                }}
                style={{ 
                  background: '#dc3545', 
                  color: 'white', 
                  border: 'none', 
                  padding: '10px 20px', 
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  width: '100%',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#c82333';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#dc3545';
                }}
              >
                🚪 ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1 style={{ margin: '0' }}>Coilmaster Electronics - Weekly Job Dashboard</h1>
        <button 
          onClick={handleCapture}
          style={{
            background: '#6c757d',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#545b62';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#6c757d';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          }}
          title="แคปภาพตาราง"
        >
          Capture
        </button>
      </div>
      
      {/* แสดงส่วนเพิ่มงานเฉพาะเมื่อล็อกอินแล้ว */}
      {isLoggedIn && (
        <div className="add-job">
          <textarea // เปลี่ยนจาก input เป็น textarea
            rows="3" // กำหนดความสูงเริ่มต้น
            placeholder="หัวข้อใหม่" // ย้าย placeholder มาที่นี่
            value={newJob}
            onChange={(e) => setNewJob(e.target.value)}
            disabled={!currentUser}
            style={{ width: '100%', minHeight: '60px', boxSizing: 'border-box', resize: 'vertical' }} // เพิ่ม style
          />
          <div className="people-selection" style={{ border: '1px solid #ccc', borderRadius: '3px', padding: '4px', marginBottom: '4px' }}>
            <div style={{ marginBottom: '4px', fontWeight: 'bold', color: '#555', fontSize: '12px' }}>เลือกผู้รับผิดชอบ:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '2px', fontSize: '11px' }}>
              {['Aoair', 'Neno', 'Sam', 'Fin', 'Toy', 'Katae', 'Ning', 'Noi', 'Paew', 'Toei', 'Pop', 'June', 'Heng', 'Ao', 'Donut', 'Ploy', 'Garfield', 'ALL'].map(person => (
                <label key={person} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '1px' }}>
                  <input
                    type="checkbox"
                    checked={selectedPeople.includes(person)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPeople([...selectedPeople, person]);
                      } else {
                        setSelectedPeople(selectedPeople.filter(p => p !== person));
                      }
                    }}
                    disabled={!currentUser}
                    style={{ marginRight: '3px', transform: 'scale(0.8)' }}
                  />
                  <span>{person}</span>
                </label>
              ))}
            </div>
            {selectedPeople.length > 0 && (
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#666' }}>
                เลือกแล้ว: {selectedPeople.join(', ')}
              </div>
            )}
          </div>
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            placeholder="วันที่ครบกำหนด"
            disabled={!currentUser}
          />
          <button 
            onClick={handleAddJob} 
            disabled={!currentUser || operationLoading}
            className={(!currentUser || operationLoading) ? 'add-job-disabled' : 'add-job-active'}
            style={{
              opacity: (!currentUser || operationLoading) ? 0.6 : 1,
              cursor: (!currentUser || operationLoading) ? 'not-allowed' : 'pointer',
              backgroundColor: (!currentUser || operationLoading) ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            {operationLoading ? 'กำลังเพิ่มงาน...' : 'เพิ่มหัวข้อ'}
          </button>
        </div>
      )}

      {/* Loading jobs message */}
      {(loading || operationLoading) && jobs.length === 0 && (
        <div style={{ color: '#888', marginBottom: 8 }}>Loading jobs...</div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="job-table job-table-animated" key={`job-table-${jobs.length}-${Date.now()}`}>
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
              <th>No.</th>
              <th>Job Title</th>
              <th>Assignee</th>
              <th>Assigned Date</th>
              <th>Due Date</th>
              <th>Completed Date</th>
              <th>Remarks</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody
            style={{
              transition: 'background 0.2s',
              position: 'relative'
            }}
          >
            {jobs.map((job, index) => {
              // หาตำแหน่ง drop gap
              let gapStyle = {};
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
                      className={`job-row ${job.status === 'เสร็จแล้ว' ? 'completed' : ''} ${job.id === animatingJobId && job.status === 'เสร็จแล้ว' ? 'job-completed-fade-out newly-completed' : ''} ${job.isOffline ? 'offline-job' : ''}`}
                      style={{
                        ...gapStyle,
                        backgroundColor: job.isOffline ? '#fff3cd' : 'inherit',
                        borderLeft: job.isOffline ? '4px solid #ffc107' : 'none'
                      }}
                    >
                      <td style={gapStyle}>{index + 1}</td>
                      <td style={gapStyle}>
                        {job.isOffline && <span style={{ color: '#856404', fontSize: '10px' }}>📱 OFFLINE </span>}
                        <span dangerouslySetInnerHTML={{ __html: job.title.replace(/\n/g, '<br/>') }} />
                      </td>
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
                          disabled={!currentUser}
                          className={!currentUser ? 'disabled-select' : ''}
                        >
                          <option value="ดำเนินการอยู่">ดำเนินการ</option>
                          <option value="รออนุมัติ">รออนุมัติ</option>
                          <option value="เลื่อน">เลื่อน</option>
                          <option value="ยกเลิก">ยกเลิก</option>
                          <option value="เสร็จแล้ว">เสร็จแล้ว</option>
                        </select>
                      </td>
                      <td style={gapStyle}>
                        {job.status === 'เสร็จแล้ว' ? (
                          <button className="button-delete" onClick={() => handleDeleteJob(job.id)}>
                            ลบ
                          </button>
                        ) : (
                          <button 
                            className="button-on-process" 
                            disabled={true}
                            style={{
                              backgroundColor: 
                                job.status === 'ดำเนินการอยู่' ? '#007bff' :
                                job.status === 'รออนุมัติ' ? '#fd7e14' :
                                job.status === 'เลื่อน' ? '#6c757d' :
                                job.status === 'ยกเลิก' ? '#dc3545' : '#6c757d',
                              color: 'white',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            {job.status === 'ดำเนินการอยู่' ? 'On process' :
                             job.status === 'รออนุมัติ' ? 'Pending Approval' :
                             job.status === 'เลื่อน' ? 'Not Started' :
                             job.status === 'ยกเลิก' ? 'Cancelled' : 'On process'}
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ) : (
                    <tr 
                      key={job.id} 
                      className={`job-row ${job.status === 'เสร็จแล้ว' ? 'completed' : ''} ${job.isOffline ? 'offline-job' : ''}`} 
                      style={{
                        ...gapStyle,
                        backgroundColor: job.isOffline ? '#fff3cd' : 'inherit',
                        borderLeft: job.isOffline ? '4px solid #ffc107' : 'none'
                      }}
                    >
                      <td style={gapStyle}>{index + 1}</td>
                      <td style={gapStyle}>
                        {job.isOffline && <span style={{ color: '#856404', fontSize: '10px' }}>📱 OFFLINE </span>}
                        <span dangerouslySetInnerHTML={{ __html: job.title.replace(/\n/g, '<br/>') }} />
                      </td>
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
                          disabled={!currentUser}
                          className={!currentUser ? 'disabled-select' : ''}
                        >
                          <option value="ดำเนินการอยู่">ดำเนินการ</option>
                          <option value="รออนุมัติ">รออนุมัติ</option>
                          <option value="เลื่อน">เลื่อน</option>
                          <option value="ยกเลิก">ยกเลิก</option>
                          <option value="เสร็จแล้ว">เสร็จแล้ว</option>
                        </select>
                      </td>
                      <td style={gapStyle}>
                        {job.status === 'เสร็จแล้ว' ? (
                          <button className="button-delete" onClick={() => handleDeleteJob(job.id)}>
                            ลบ
                          </button>
                        ) : (
                          <button 
                            className="button-on-process" 
                            disabled={true}
                            style={{
                              backgroundColor: 
                                job.status === 'ดำเนินการอยู่' ? '#007bff' :
                                job.status === 'รออนุมัติ' ? '#fd7e14' :
                                job.status === 'เลื่อน' ? '#6c757d' :
                                job.status === 'ยกเลิก' ? '#dc3545' : '#6c757d',
                              color: 'white',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            {job.status === 'ดำเนินการอยู่' ? 'On process' :
                             job.status === 'รออนุมัติ' ? 'Pending Approval' :
                             job.status === 'เลื่อน' ? 'Not Started' :
                             job.status === 'ยกเลิก' ? 'Cancelled' : 'On process'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            
            {/* Export button as last row */}
            <tr className="export-row">
              <td colSpan={9} style={{ 
                textAlign: 'center', 
                padding: '15px',
                background: '#e8f5e8',
                borderTop: '1px solid #c3e6c3',
                border: 'none',
                verticalAlign: 'middle'
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                  <button 
                    onClick={handleExport} 
                    className="export-button"
                    style={{
                      background: '#28a745',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'white',
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      margin: '0 auto',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#218838';
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#28a745';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>📊</span>
                    Export
                  </button>
                </div>
              </td>
            </tr>
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
