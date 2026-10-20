// =========================================================
// FIREBASE CONFIGURATION
// Replace with your real Firebase Project credentials
// =========================================================
 const firebaseConfig = {
    apiKey: "AIzaSyBLZody_bJD2faSrW-DeZm-iypDmIjrD9o",
    authDomain: "website-f25bf.firebaseapp.com",
    databaseURL: "https://website-f25bf-default-rtdb.firebaseio.com",
    projectId: "website-f25bf",
    storageBucket: "website-f25bf.firebasestorage.app",
    messagingSenderId: "909073228938",
    appId: "1:909073228938:web:c62685afc8fb4d60b6b973",
    measurementId: "G-Z2SW3HRVJK"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Application State
let currentUser = null;
let activeChatUserId = null;
let typingTimeout = null;
let selectedMessageForContext = null;

// =========================================================
// INITIALIZATION & EMOJI EVENT LISTENERS
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  // Listen for Firebase Auth state changes
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      const fallbackName = user.isAnonymous ? "Guest User" : (user.displayName || "User");

      // Load Current User Details
      db.ref(`users/${user.uid}`).once('value').then((snapshot) => {
        const val = snapshot.val();
        const displayName = val ? val.name : fallbackName;
        document.getElementById('current-user-name').innerText = displayName;
        document.getElementById('current-user-avatar').innerText = displayName.charAt(0).toUpperCase();
      });

      // Show Chat Container, Hide Auth
      document.getElementById('auth-container').classList.add('hidden');
      document.getElementById('chat-container').classList.remove('hidden');

      // Initialize App Data Listeners
      loadUsersList();
      loadActivityLogs();
    } else {
      currentUser = null;
      document.getElementById('auth-container').classList.remove('hidden');
      document.getElementById('chat-container').classList.add('hidden');
    }
  });

  // Attach Emoji Picker Selection Event
  const emojiPicker = document.getElementById('emoji-picker');
  if (emojiPicker) {
    emojiPicker.addEventListener('emoji-click', (event) => {
      const input = document.getElementById('message-input');
      input.value += event.detail.unicode;
    });
  }

  // Close context menu on outside click
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('message-menu');
    if (menu && !menu.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
});

// =========================================================
// THEME TOGGLE FUNCTION
// =========================================================
function toggleTheme() {
  const html = document.documentElement;
  const themeIcon = document.getElementById('theme-icon');
  const currentTheme = html.getAttribute('data-theme');

  if (currentTheme === 'dark') {
    html.setAttribute('data-theme', 'light');
    themeIcon.className = 'fa-solid fa-moon';
  } else {
    html.setAttribute('data-theme', 'dark');
    themeIcon.className = 'fa-solid fa-sun';
  }
}

// =========================================================
// AUTHENTICATION FUNCTIONS
// =========================================================
function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    loginTab.classList.remove('active');
    signupTab.classList.add('active');
  }
}

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      logActivity(userCredential.user.uid, 'Logged In');
    })
    .catch((error) => alert('Login Error: ' + error.message));
}

function handleSignup(event) {
  event.preventDefault();
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      user.updateProfile({ displayName: name });

      // Save user node in Database
      db.ref(`users/${user.uid}`).set({
        uid: user.uid,
        name: name,
        email: email
      });

      logActivity(user.uid, 'Registered & Logged In');
    })
    .catch((error) => alert('Signup Error: ' + error.message));
}

function handleGuestLogin() {
  auth.signInAnonymously()
    .then((userCredential) => {
      const user = userCredential.user;
      const randomGuestName = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

      db.ref(`users/${user.uid}`).set({
        uid: user.uid,
        name: randomGuestName,
        email: 'guest@chat.com'
      });

      logActivity(user.uid, 'Logged In as Guest');
    })
    .catch((error) => alert('Guest Login Error: ' + error.message));
}

function handleLogout() {
  if (currentUser) {
    logActivity(currentUser.uid, 'Logged Out');
    auth.signOut();
  }
}

// Log System Activity to Firebase
function logActivity(uid, action) {
  db.ref(`users/${uid}`).once('value').then((snap) => {
    const name = snap.val() ? snap.val().name : "User";
    const logRef = db.ref('activity_logs').push();
    logRef.set({
      uid: uid,
      userName: name,
      action: action,
      timestamp: Date.now()
    });
  });
}

// =========================================================
// SIDEBAR & LIST MANAGEMENT
// =========================================================
function switchSidebarTab(tab) {
  const usersPanel = document.getElementById('users-panel');
  const activityPanel = document.getElementById('activity-panel');
  const usersTabBtn = document.getElementById('tab-users-btn');
  const activityTabBtn = document.getElementById('tab-activity-btn');

  if (tab === 'users') {
    usersPanel.classList.add('active');
    activityPanel.classList.remove('active');
    usersTabBtn.classList.add('active');
    activityTabBtn.classList.remove('active');
  } else {
    usersPanel.classList.remove('active');
    activityPanel.classList.add('active');
    usersTabBtn.classList.remove('active');
    activityTabBtn.classList.add('active');
  }
}

function loadUsersList() {
  db.ref('users').on('value', (snapshot) => {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';
    
    snapshot.forEach((childSnap) => {
      const user = childSnap.val();
      if (user.uid !== currentUser.uid) {
        const li = document.createElement('li');
        li.className = `user-item ${activeChatUserId === user.uid ? 'active' : ''}`;
        li.setAttribute('data-id', user.uid);
        li.setAttribute('data-name', user.name.toLowerCase());
        li.onclick = () => selectChatUser(user);

        li.innerHTML = `
          <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
          <div class="details">
            <h4>${user.name}</h4>
            <p>${user.email}</p>
          </div>
        `;
        usersList.appendChild(li);
      }
    });
  });
}

function loadActivityLogs() {
  db.ref('activity_logs').limitToLast(20).on('value', (snapshot) => {
    const activityList = document.getElementById('activity-list');
    activityList.innerHTML = '';
    
    const logs = [];
    snapshot.forEach((child) => { logs.push(child.val()); });
    logs.reverse(); // Newest first

    logs.forEach((log) => {
      const li = document.createElement('li');
      li.className = 'activity-item';
      const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date(log.timestamp).toLocaleDateString();

      li.innerHTML = `
        <strong>${log.userName}</strong> ${log.action}
        <span class="log-time">${dateStr} at ${timeStr}</span>
      `;
      activityList.appendChild(li);
    });
  });
}

function filterList() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const items = document.querySelectorAll('.user-item');

  items.forEach((item) => {
    const name = item.getAttribute('data-name');
    if (name.includes(query)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// =========================================================
// CHAT FUNCTIONALITY & REALTIME MESSAGING
// =========================================================
function selectChatUser(user) {
  activeChatUserId = user.uid;

  // Update UI Elements
  document.getElementById('chat-user-name').innerText = user.name;
  document.getElementById('chat-user-avatar').innerText = user.name.charAt(0).toUpperCase();
  document.getElementById('chat-user-status').innerText = "Online";

  // Active state in list
  document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`.user-item[data-id="${user.uid}"]`);
  if (activeEl) activeEl.classList.add('active');

  // Load Messages & Typing Listener
  loadMessages();
  listenTypingStatus();
}

function getChatRoomId() {
  if (!currentUser || !activeChatUserId) return null;
  return currentUser.uid < activeChatUserId 
    ? `${currentUser.uid}_${activeChatUserId}` 
    : `${activeChatUserId}_${currentUser.uid}`;
}

function loadMessages() {
  const roomId = getChatRoomId();
  if (!roomId) return;

  const messagesContainer = document.getElementById('messages-container');

  db.ref(`chats/${roomId}/messages`).on('value', (snapshot) => {
    messagesContainer.innerHTML = '';

    if (!snapshot.exists()) {
      messagesContainer.innerHTML = `
        <div class="empty-chat-placeholder">
          <i class="fa-regular fa-paper-plane"></i>
          <p>No messages yet. Say hi!</p>
        </div>`;
      return;
    }

    snapshot.forEach((childSnap) => {
      const msgKey = childSnap.key;
      const msg = childSnap.val();

      // Skip if deleted for current user
      if (msg.deletedFor && msg.deletedFor[currentUser.uid]) {
        return;
      }

      const isSent = msg.senderId === currentUser.uid;
      const msgRow = document.createElement('div');
      msgRow.className = `message-row ${isSent ? 'sent' : 'received'}`;
      
      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let contentHtml = '';
      if (msg.deletedForEveryone) {
        contentHtml = `<div class="message-bubble deleted"><i class="fa-solid fa-ban"></i> This message was deleted</div>`;
      } else {
        contentHtml = `
          <div class="message-bubble" oncontextmenu="openContextMenu(event, '${msgKey}', ${isSent})">
            ${msg.text}
          </div>
          <div class="reaction-bar">
            <button class="reaction-btn" onclick="addReaction('${msgKey}', '❤️')">❤️</button>
            <button class="reaction-btn" onclick="addReaction('${msgKey}', '😂')">😂</button>
            <button class="reaction-btn" onclick="addReaction('${msgKey}', '👍')">👍</button>
          </div>
        `;
      }

      // Render reactions if present
      let reactionsHtml = '';
      if (msg.reactions) {
        const counts = {};
        Object.values(msg.reactions).forEach(r => counts[r] = (counts[r] || 0) + 1);
        const summary = Object.entries(counts).map(([emoji, count]) => `${emoji} ${count}`).join(' ');
        reactionsHtml = `<div class="reactions-display">${summary}</div>`;
      }

      msgRow.innerHTML = `
        ${contentHtml}
        ${reactionsHtml}
        <span class="message-time">${timeStr}</span>
      `;

      messagesContainer.appendChild(msgRow);
    });

    // Auto Scroll to Bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  const roomId = getChatRoomId();

  if (!text || !roomId) return;

  const msgRef = db.ref(`chats/${roomId}/messages`).push();
  msgRef.set({
    senderId: currentUser.uid,
    text: text,
    timestamp: Date.now()
  });

  input.value = '';
  document.getElementById('emoji-picker-wrapper').classList.add('hidden');

  // Clear typing indicator status
  db.ref(`chats/${roomId}/typing/${currentUser.uid}`).set(false);
}

function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

// =========================================================
// TYPING INDICATOR
// =========================================================
function handleTyping() {
  const roomId = getChatRoomId();
  if (!roomId) return;

  db.ref(`chats/${roomId}/typing/${currentUser.uid}`).set(true);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    db.ref(`chats/${roomId}/typing/${currentUser.uid}`).set(false);
  }, 2000);
}

function listenTypingStatus() {
  const roomId = getChatRoomId();
  if (!roomId) return;

  db.ref(`chats/${roomId}/typing/${activeChatUserId}`).on('value', (snapshot) => {
    const isTyping = snapshot.val();
    const indicator = document.getElementById('typing-indicator');

    if (isTyping) {
      const activeName = document.getElementById('chat-user-name').innerText;
      document.getElementById('typing-username').innerText = activeName;
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  });
}

// =========================================================
// REACTIONS & EMOJI TOGGLE
// =========================================================
function toggleEmojiPicker() {
  const wrapper = document.getElementById('emoji-picker-wrapper');
  wrapper.classList.toggle('hidden');
}

function addReaction(msgKey, emoji) {
  const roomId = getChatRoomId();
  if (!roomId) return;

  db.ref(`chats/${roomId}/messages/${msgKey}/reactions/${currentUser.uid}`).set(emoji);
}

// =========================================================
// CONTEXT MENU & MESSAGE DELETION
// =========================================================
function openContextMenu(event, msgKey, isSent) {
  event.preventDefault();
  selectedMessageForContext = msgKey;

  const menu = document.getElementById('message-menu');
  const deleteEveryoneBtn = document.getElementById('delete-everyone-btn');

  // Only show "Delete for Everyone" if user sent the message
  if (isSent) {
    deleteEveryoneBtn.style.display = 'block';
  } else {
    deleteEveryoneBtn.style.display = 'none';
  }

  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.classList.remove('hidden');
}

function deleteForMe() {
  const roomId = getChatRoomId();
  if (!roomId || !selectedMessageForContext) return;

  db.ref(`chats/${roomId}/messages/${selectedMessageForContext}/deletedFor/${currentUser.uid}`).set(true);
  document.getElementById('message-menu').classList.add('hidden');
}

function deleteForEveryone() {
  const roomId = getChatRoomId();
  if (!roomId || !selectedMessageForContext) return;

  db.ref(`chats/${roomId}/messages/${selectedMessageForContext}`).update({
    deletedForEveryone: true,
    text: "This message was deleted"
  });

  document.getElementById('message-menu').classList.add('hidden');
}

// =========================================================
// CALL OVERLAYS (VOICE & VIDEO UI)
// =========================================================
function startCall(type) {
  if (!activeChatUserId) {
    alert('Please select a user to call!');
    return;
  }

  const name = document.getElementById('chat-user-name').innerText;
  document.getElementById('call-username').innerText = name;
  document.getElementById('call-avatar').innerText = name.charAt(0).toUpperCase();
  document.getElementById('call-type').innerText = type === 'video' ? 'Video Calling...' : 'Voice Calling...';

  const videoPreview = document.getElementById('video-preview');
  if (type === 'video') {
    videoPreview.classList.remove('hidden');
  } else {
    videoPreview.classList.add('hidden');
  }

  document.getElementById('call-modal').classList.remove('hidden');
}

function endCall() {
  document.getElementById('call-modal').classList.add('hidden');
}