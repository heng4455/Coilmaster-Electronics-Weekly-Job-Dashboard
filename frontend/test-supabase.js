// Test script สำหรับตรวจสอบ Supabase connection
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ezrroridxfxbuthgjdgq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cnJvcmlkeGZ4YnV0aGdqZGdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTA3NDAsImV4cCI6MjA2NjU4Njc0MH0.t3nwTj6xmxDsG-QHLnCG81Iaxpfi1LqlYKMYxwgdJ3A';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  console.log('URL:', supabaseUrl);
  
  try {
    // Test 1: Check auth status
    console.log('\n1. Testing auth status...');
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.log('Auth error:', sessionError.message);
    } else {
      console.log('Auth test successful, session exists:', !!session);
    }
    
    // Test 2: Simple table query
    console.log('\n2. Testing simple table query...');
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profileError) {
      console.log('Profiles error:', profileError.message);
      console.log('Error details:', profileError);
    } else {
      console.log('Profiles test successful, data length:', profiles?.length || 0);
      if (profiles && profiles.length > 0) {
        console.log('Profile structure:', Object.keys(profiles[0]));
        console.log('Sample profile:', profiles[0]);
      }
    }
    
    // Test 3: Jobs table query
    console.log('\n3. Testing jobs table query...');
    const { data: jobs, error: jobError } = await supabase
      .from('jobs')
      .select('id')
      .limit(1);
    
    if (jobError) {
      console.log('Jobs error:', jobError.message);
      console.log('Error details:', jobError);
    } else {
      console.log('Jobs test successful, data length:', jobs?.length || 0);
    }
    
    console.log('\nConnection test completed!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testConnection();
