// Utility functions for Supabase session management
import { supabase } from '../supabaseClient';

// ล้าง localStorage ที่เกี่ยวข้องกับ Supabase
export const clearSupabaseStorage = () => {
  try {
    // ล้าง localStorage
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sb-'))
      .forEach((key) => localStorage.removeItem(key));
    
    // ล้าง sessionStorage
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('sb-'))
      .forEach((key) => sessionStorage.removeItem(key));

    // ล้าง saved credentials
    localStorage.removeItem('savedEmail');
    localStorage.removeItem('savedPassword');
    localStorage.removeItem('jobsOrder');

    console.log('Supabase storage cleared');
  } catch (error) {
    console.error('Error clearing Supabase storage:', error);
  }
};

// รีเซ็ต session ทั้งหมด
export const resetSession = async () => {
  try {
    // Sign out จาก Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
    
    // ล้าง storage
    clearSupabaseStorage();
    
    console.log('Session reset successfully');
  } catch (error) {
    console.error('Error resetting session:', error);
    // ถ้าไม่สามารถ signOut ได้ ให้ล้าง storage อย่างน้อย
    clearSupabaseStorage();
  }
};

// ตรวจสอบ session validity (ไม่ใช้แล้ว เพราะมีปัญหา)
export const validateSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Session validation error:', error);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Session validation failed:', error);
    return null;
  }
};

// ตรวจสอบการเชื่อมต่อ Supabase
export const checkSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    
    // ลองเชื่อมต่อแบบง่าย ๆ ก่อน พร้อม timeout ที่เหมาะกับ network ในไทย
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.log('Connection test timed out after 30 seconds');
        reject(new Error('Connection timeout after 30 seconds'));
      }, 30000);
    });
    
    // ลองหลายวิธี: 1) ตรวจสอบ table count, 2) ตรวจสอบ auth status, 3) ตรวจสอบ basic connection
    let connectionResult = null;
    
    // วิธีที่ 1: ตรวจสอบ auth status (รวดเร็วที่สุด)
    try {
      console.log('Method 1: Testing auth status...');
      const authPromise = supabase.auth.getSession();
      const authResult = await Promise.race([authPromise, timeoutPromise]);
      console.log('Auth test successful:', !!authResult?.data?.session);
      connectionResult = { success: true, method: 'auth' };
    } catch (authError) {
      console.log('Method 1 failed:', authError.message);
    }
    
    // วิธีที่ 2: ถ้าแล้ว auth ไม่ได้ ลองเช็ค table แบบ simple
    if (!connectionResult) {
      try {
        console.log('Method 2: Testing simple table access...');
        const simplePromise = supabase.from('profiles').select('user_id').limit(1);
        const simpleResult = await Promise.race([simplePromise, timeoutPromise]);
        console.log('Simple table test successful');
        connectionResult = { success: true, method: 'table' };
      } catch (tableError) {
        console.log('Method 2 failed:', tableError.message);
      }
    }
    
    // วิธีที่ 3: ถ้ายังไม่ได้ ลองเช็ค health ของ Supabase API
    if (!connectionResult) {
      try {
        console.log('Method 3: Testing RPC health check...');
        const healthPromise = supabase.rpc('version');
        const healthResult = await Promise.race([healthPromise, timeoutPromise]);
        console.log('Health check successful');
        connectionResult = { success: true, method: 'rpc' };
      } catch (rpcError) {
        console.log('Method 3 failed:', rpcError.message);
      }
    }
    
    if (connectionResult) {
      console.log('Supabase connection successful via:', connectionResult.method);
      return {
        success: true,
        message: `Connected successfully via ${connectionResult.method}`
      };
    } else {
      throw new Error('All connection methods failed');
    }
    
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return {
      success: false,
      message: error.message || 'Connection failed'
    };
  }
};
