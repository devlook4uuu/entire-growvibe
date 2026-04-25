// ==================== ADMIN MOCK DATA ====================
export const adminData = {
  stats: {
    totalSchools: { count: 24, active: 21 },
    totalStudents: { count: 12840 },
    saasRevenue: { amount: 485000, schools: 24 },
    storeRevenue: { amount: 128500, pendingOrders: 18 },
  },
  pendingOrders: [
    { id: 1, student: 'Ahmed Raza', school: 'GrowVibe Academy', product: 'School Bag (Blue)', paymentType: 'COD', status: 'pending' },
    { id: 2, student: 'Sana Fatima', school: 'Al-Noor School', product: 'Uniform Set (M)', paymentType: 'Online', status: 'processing' },
    { id: 3, student: 'Hamza Ali', school: 'Bright Future Academy', product: 'Water Bottle', paymentType: 'COD', status: 'pending' },
    { id: 4, student: 'Maryam Sheikh', school: 'GrowVibe Academy', product: 'Notebook Pack (6)', paymentType: 'Online', status: 'shipped' },
  ],
  revenueChart: [
    { month: 'Nov', revenue: 320000, target: 400000 },
    { month: 'Dec', revenue: 380000, target: 400000 },
    { month: 'Jan', revenue: 410000, target: 450000 },
    { month: 'Feb', revenue: 445000, target: 450000 },
    { month: 'Mar', revenue: 460000, target: 500000 },
    { month: 'Apr', revenue: 485000, target: 500000 },
  ],
  supportTickets: [
    { id: 1, subject: 'Fee module not loading', school: 'Al-Noor School', timeAgo: '2 hours ago', status: 'open' },
    { id: 2, subject: 'Student import failed', school: 'Bright Future Academy', timeAgo: '5 hours ago', status: 'open' },
    { id: 3, subject: 'Attendance sync issue', school: 'GrowVibe Academy', timeAgo: '1 day ago', status: 'closed' },
    { id: 4, subject: 'Report card template', school: 'Iqbal Public School', timeAgo: '2 days ago', status: 'open' },
  ],
  schoolsStatus: [
    { id: 1, name: 'GrowVibe Academy', city: 'Lahore', students: 1250, branches: 3, status: 'active' },
    { id: 2, name: 'Al-Noor School', city: 'Karachi', students: 890, branches: 2, status: 'active' },
    { id: 3, name: 'Bright Future Academy', city: 'Islamabad', students: 650, branches: 1, status: 'active' },
    { id: 4, name: 'Iqbal Public School', city: 'Faisalabad', students: 430, branches: 1, status: 'inactive' },
  ],
};

// ==================== OWNER MOCK DATA ====================
export const ownerData = {
  schoolName: 'GrowVibe Academy',
  branches: 3,
  session: '2025-26',
  stats: {
    totalStudents: { count: 1250 },
    todayAttendance: { percentage: 89, present: 1112, absent: 138, label: 'School-wide' },
    feesCollected: { amount: 2850000, unpaid: 87 },
    activeStaff: { count: 68 },
  },
  branchAttendance: [
    { branch: 'Main Campus', present: 480, absent: 45, late: 12, percentage: 92, unmarked: 0 },
    { branch: 'City Branch', present: 380, absent: 52, late: 8, percentage: 87, unmarked: 2 },
    { branch: 'Township Branch', present: 252, absent: 41, late: 5, percentage: 86, unmarked: 0 },
  ],
  feeCollection: [
    { branch: 'Main Campus', collected: 1250000, unpaid: 28, total: 1400000 },
    { branch: 'City Branch', collected: 920000, unpaid: 35, total: 1100000 },
    { branch: 'Township Branch', collected: 680000, unpaid: 24, total: 800000 },
  ],
  recentActivity: [
    { actor: 'Dr. Fatima Malik', action: 'Approved teacher leave for Bilal Tariq', timeAgo: '15 min ago' },
    { actor: 'Ayesha Khan', action: 'Marked Grade 5-A attendance', timeAgo: '1 hour ago' },
    { actor: 'Admin System', action: 'Fee reminder sent to 87 students', timeAgo: '2 hours ago' },
    { actor: 'Hassan Ahmed', action: 'Added new staff member: Usman Ali', timeAgo: '3 hours ago' },
  ],
  pendingApplications: [
    { name: 'Zainab Hussain', type: 'Student Admission', classBranch: 'Grade 3 · Main Campus', status: 'pending' },
    { name: 'Kamran Yousuf', type: 'Teacher Application', classBranch: 'Science Dept · City Branch', status: 'review' },
    { name: 'Areesha Noor', type: 'Student Admission', classBranch: 'Grade 1 · Township', status: 'pending' },
  ],
};

// ==================== PRINCIPAL MOCK DATA ====================
export const principalData = {
  branchName: 'Main Campus',
  schoolName: 'GrowVibe Academy',
  classCount: 18,
  studentCount: 525,
  stats: {
    branchStudents: { count: 525, classes: 18 },
    todayAttendance: { percentage: 92, present: 483, absent: 42, unmarkedClasses: 2 },
    aprilFees: { collected: 1250000, unpaid: 28, pendingAmount: 168000 },
    pendingApplications: { count: 5, students: 3, teachers: 2, label: 'Action needed' },
  },
  classAttendance: [
    { className: 'Grade 1-A', teacher: 'Miss Hira', present: 28, absent: 2, markedTime: '8:15 AM', status: 'marked' },
    { className: 'Grade 2-A', teacher: 'Miss Sadia', present: 30, absent: 1, markedTime: '8:20 AM', status: 'marked' },
    { className: 'Grade 3-A', teacher: 'Sir Usman', present: 25, absent: 5, markedTime: '8:10 AM', status: 'marked' },
    { className: 'Grade 4-A', teacher: 'Miss Amna', present: 0, absent: 0, markedTime: '-', status: 'missing' },
    { className: 'Grade 5-A', teacher: 'Sir Bilal', present: 27, absent: 3, markedTime: '8:25 AM', status: 'marked' },
  ],
  pendingApplications: [
    { name: 'Zainab Hussain', type: 'Student', awaiting: 'Document Verification', canAction: false },
    { name: 'Kamran Yousuf', type: 'Teacher', awaiting: 'Your Approval', canAction: true },
    { name: 'Rabia Noor', type: 'Teacher', awaiting: 'Your Approval', canAction: true },
    { name: 'Areesha Noor', type: 'Student', awaiting: 'Interview Scheduled', canAction: false },
  ],
  topGrowCoins: [
    { rank: 1, name: 'Ahmed Raza', className: 'Grade 5-A', balance: 450, awards: 12 },
    { rank: 2, name: 'Fatima Zahra', className: 'Grade 4-A', balance: 420, awards: 10 },
    { rank: 3, name: 'Hassan Ali', className: 'Grade 5-A', balance: 385, awards: 9 },
    { rank: 4, name: 'Maryam Sheikh', className: 'Grade 3-A', balance: 360, awards: 8 },
    { rank: 5, name: 'Hamza Khan', className: 'Grade 4-A', balance: 340, awards: 7 },
  ],
  recentNotes: [
    { title: 'Annual Sports Day Announcement', scope: 'school', postedBy: 'Admin', date: 'Apr 10, 2026' },
    { title: 'PTM Schedule for April', scope: 'branch', postedBy: 'Dr. Fatima', date: 'Apr 8, 2026' },
    { title: 'Science Fair Projects Submission', scope: 'class', postedBy: 'Sir Bilal', date: 'Apr 7, 2026' },
  ],
};

// ==================== COORDINATOR MOCK DATA ====================
export const coordinatorData = {
  branchName: 'Main Campus',
  schoolName: 'GrowVibe Academy',
  stats: {
    todayAttendance: { percentage: 92, present: 483, absent: 42, unmarkedClasses: 2 },
    pendingApplications: { count: 4, label: 'Awaiting you' },
    feeRecords: { total: 525, unpaid: 28, pendingAmount: 168000 },
  },
  unmarkedClasses: ['Grade 4-A', 'Grade 6-B'],
  classAttendance: [
    { className: 'Grade 1-A', teacher: 'Miss Hira', students: 30, present: 28, markedTime: '8:15 AM', status: 'marked' },
    { className: 'Grade 2-A', teacher: 'Miss Sadia', students: 31, present: 30, markedTime: '8:20 AM', status: 'marked' },
    { className: 'Grade 3-A', teacher: 'Sir Usman', students: 30, present: 25, markedTime: '8:10 AM', status: 'marked' },
    { className: 'Grade 4-A', teacher: 'Miss Amna', students: 28, present: 0, markedTime: '-', status: 'missing' },
    { className: 'Grade 5-A', teacher: 'Sir Bilal', students: 30, present: 27, markedTime: '8:25 AM', status: 'marked' },
  ],
  teacherApplications: [
    { name: 'Sir Bilal Tariq', leaveType: 'Sick Leave', date: 'Apr 11, 2026', status: 'pending' },
    { name: 'Miss Hira Shah', leaveType: 'Casual Leave', date: 'Apr 12-13, 2026', status: 'pending' },
    { name: 'Sir Usman Ghani', leaveType: 'Half Day', date: 'Apr 10, 2026', status: 'pending' },
  ],
  unpaidFees: [
    { className: 'Grade 1-A', unpaidStudents: 4, pendingAmount: 24000 },
    { className: 'Grade 2-A', unpaidStudents: 3, pendingAmount: 18000 },
    { className: 'Grade 3-A', unpaidStudents: 6, pendingAmount: 36000 },
    { className: 'Grade 4-A', unpaidStudents: 8, pendingAmount: 48000 },
    { className: 'Grade 5-A', unpaidStudents: 7, pendingAmount: 42000 },
  ],
  activeChats: [
    { className: 'Grade 5-A', lastMessage: 'Sir Bilal: Tomorrow\'s homework is...', unread: 3 },
    { className: 'Grade 3-A', lastMessage: 'Miss Sana: PTM reminder for...', unread: 1 },
    { className: 'Grade 1-A', lastMessage: 'Miss Hira: Art supplies needed...', unread: 0 },
  ],
};

// ==================== TEACHER MOCK DATA ====================
export const teacherData = {
  name: 'Bilal Tariq',
  className: 'Grade 5-A',
  studentCount: 30,
  attendanceMarked: true,
  attendanceTime: '8:25 AM',
  attendancePresent: 27,
  attendanceAbsent: 3,
  stats: {
    myClass: { count: 30 },
    todayAttendance: { percentage: 90, present: 27, absent: 3, marked: true },
    growTasks: { submitted: 2, total: 3, pendingCategory: 'Cleanliness' },
    todayTimetable: { periods: 7, nextPeriod: 'Mathematics', nextTime: '11:00 AM', currentPeriod: 'English' },
  },
  timetable: [
    { period: 1, subject: 'Assembly', time: '7:45 - 8:15', teacher: 'All Staff', isCurrent: false },
    { period: 2, subject: 'English', time: '8:15 - 9:00', teacher: 'Sir Bilal', isCurrent: true },
    { period: 3, subject: 'Mathematics', time: '9:00 - 9:45', teacher: 'Sir Bilal', isCurrent: false },
    { period: 4, subject: 'Science', time: '9:45 - 10:30', teacher: 'Miss Nadia', isCurrent: false },
    { period: 5, subject: 'Break', time: '10:30 - 11:00', teacher: '-', isCurrent: false },
    { period: 6, subject: 'Islamiat', time: '11:00 - 11:45', teacher: 'Sir Ahmed', isCurrent: false },
    { period: 7, subject: 'Urdu', time: '11:45 - 12:30', teacher: 'Sir Bilal', isCurrent: false },
  ],
  growTasks: [
    { category: 'Discipline', submitted: true, dueDate: 'Apr 11', status: 'submitted' },
    { category: 'Study', submitted: true, dueDate: 'Apr 11', status: 'submitted' },
    { category: 'Cleanliness', submitted: false, dueDate: 'Apr 11', status: 'pending' },
  ],
  todayDiary: [
    { subject: 'English', posted: true, notified: true },
    { subject: 'Mathematics', posted: true, notified: true },
    { subject: 'Urdu', posted: false, notified: false },
  ],
  classChat: [
    { sender: 'Miss Nadia', message: 'Science project submissions extended to Friday', time: '9:50 AM' },
    { sender: 'Sir Bilal', message: 'Reminder: Bring art supplies tomorrow', time: '8:30 AM' },
  ],
  unreadMessages: 4,
};

// ==================== STUDENT MOCK DATA ====================
export const studentData = {
  name: 'Muhammad Ali',
  className: 'Grade 5-A',
  schoolName: 'GrowVibe Academy',
  branchName: 'Main Campus',
  stats: {
    growCoins: { balance: 320, todayEarnings: 15 },
    weekAttendance: { present: 4, total: 5 },
    monthAttendance: { present: 18, total: 20, coinsEarned: true },
  },
  weeklyAttendance: [
    { day: 'Mon', status: 'present' },
    { day: 'Tue', status: 'present' },
    { day: 'Wed', status: 'absent' },
    { day: 'Thu', status: 'present' },
    { day: 'Fri', status: 'today' },
  ],
  growCoins: {
    balance: 320,
    transactions: [
      { type: 'Attendance Bonus', amount: '+10', date: 'Apr 10' },
      { type: 'GrowTask Reward', amount: '+5', date: 'Apr 9' },
      { type: 'Voucher Redeemed', amount: '-50', date: 'Apr 8' },
    ],
    vouchers: {
      basic: { required: 200, current: 320, label: 'Basic Voucher' },
      premium: { required: 500, current: 320, label: 'Premium Voucher' },
    },
  },
  feeStatus: {
    month: 'April 2026',
    status: 'unpaid',
    amount: 6000,
  },
  todayDiary: [
    { subject: 'English', homework: 'Complete exercise 5.3 from textbook, pages 78-79' },
    { subject: 'Mathematics', homework: 'Solve practice set 12, questions 1-15' },
    { subject: 'Urdu', homework: 'Write essay on "Mera Watan" (200 words)' },
  ],
  myOrders: [
    { product: 'School Bag (Blue)', status: 'delivered', deliveryWeek: 'Apr 7-11' },
    { product: 'Notebook Pack (6)', status: 'processing', deliveryWeek: 'Apr 14-18' },
  ],
};
