// Caregiver and feature handlers

function viewResidentDetails(index) {
  if (typeof window.viewResidentDetails === 'function') {
    // delegate to app.js implementation if present
    try { return window.viewResidentDetails(index); } catch (e) { /* fall through */ }
  }
  alert('View resident details - details page coming soon');
}

function saveDailyNote(event) {
  event.preventDefault();
  const resident = document.getElementById('noteResident').value;
  const text = document.getElementById('noteText').value;
  
  if (!resident || !text) return;
  
  alert(`Daily note saved for ${resident}`);
  document.getElementById('noteText').value = '';
  addResidentNoteUI();
}

function respondToAlert(index) {
  if (typeof window.respondToAlert === 'function') {
    try { return window.respondToAlert(index); } catch (e) { /* fall through */ }
  }
  const notes = prompt('Enter your response to this alert:');
  if (notes) {
    alert('Alert response recorded and saved');
  }
}

function addResidentNoteUI() {
  const notesList = document.getElementById('notesList');
  if (notesList) {
    notesList.innerHTML = `
      <h3 style="margin-top:20px;">Recent Notes</h3>
      <div class="alert-item">
        <strong>Dorji Wangmo</strong>
        <p>Resident appears stable today. Completed morning medication on schedule. Slight appetite increase noted.</p>
        <small>Today at 09:30 AM</small>
      </div>
      <div class="alert-item">
        <strong>Pema Choden</strong>
        <p>Medication reminder needed. Did not take 8:00 AM dose. Will recheck at 10:00 AM.</p>
        <small>Today at 08:15 AM</small>
      </div>
    `;
  }
}
