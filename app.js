const state = {
  sentences: [],
  weights: [],
  cumulativeWeights: [],
  currentIndex: -1,
  manualAnchors: [],
  transcriptText: "",
  audioUrl: null,
};

const $ = (id) => document.getElementById(id);

const audioFile = $("audioFile");
const textFile = $("textFile");
const pasteText = $("pasteText");
const loadLessonBtn = $("loadLessonBtn");
const audioPlayer = $("audioPlayer");
const transcript = $("transcript");
const searchInput = $("searchInput");
const speedSelect = $("speedSelect");
const lessonTitle = $("lessonTitle");
const sentenceCounter = $("sentenceCounter");
const dictionaryPopup = $("dictionaryPopup");
const dictionaryWord = $("dictionaryWord");
const dictionaryMeaning = $("dictionaryMeaning");
const dictionaryContext = $("dictionaryContext");

audioFile.addEventListener("change", () => {
  $("audioFileName").textContent = audioFile.files[0]?.name || "Choose MP3, M4A, WAV…";
});

textFile.addEventListener("change", async () => {
  const file = textFile.files[0];
  $("textFileName").textContent = file?.name || "Choose TXT";
  if (file) pasteText.value = await file.text();
});

loadLessonBtn.addEventListener("click", loadLesson);
audioPlayer.addEventListener("loadedmetadata", rebuildTimeline);
audioPlayer.addEventListener("timeupdate", updateHighlightFromAudio);
speedSelect.addEventListener("change", () => {
  audioPlayer.playbackRate = Number(speedSelect.value);
});
searchInput.addEventListener("input", applySearch);

$("prevSentenceBtn").addEventListener("click", () => setCurrentSentence(Math.max(0, state.currentIndex - 1), true));
$("nextSentenceBtn").addEventListener("click", () => setCurrentSentence(Math.min(state.sentences.length - 1, state.currentIndex + 1), true));
$("syncHereBtn").addEventListener("click", syncCurrentSentenceHere);
$("closeDictionary").addEventListener("click", () => dictionaryPopup.hidden = true);

$("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("tk-theme", document.body.classList.contains("dark") ? "dark" : "light");
});

if (localStorage.getItem("tk-theme") === "dark") document.body.classList.add("dark");

async function loadLesson() {
  const audio = audioFile.files[0];
  const text = pasteText.value.trim();

  if (!audio) return showToast("Choose the lesson audio first.");
  if (!text) return showToast("Choose or paste the transcript.");

  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(audio);
  audioPlayer.src = state.audioUrl;
  audioPlayer.load();

  state.transcriptText = cleanTranscript(text);
  state.sentences = splitIntoSentences(state.transcriptText);
  state.currentIndex = 0;
  state.manualAnchors = [];
  state.weights = state.sentences.map(sentenceWeight);
  state.cumulativeWeights = makeCumulative(state.weights);

  lessonTitle.textContent = audio.name.replace(/\.[^/.]+$/, "");
  renderTranscript();
  setCurrentSentence(0, false);
  searchInput.value = "";
  dictionaryPopup.hidden = true;
  showToast("Lesson loaded.");
}

function cleanTranscript(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoSentences(text) {
  const normalized = text.replace(/\n+/g, " ");
  const matches = normalized.match(/[^.!?…]+(?:[.!?…]+["'’”)]*|$)/g);
  return (matches || [normalized]).map(s => s.trim()).filter(Boolean);
}

function sentenceWeight(sentence) {
  const words = sentence.match(/[A-Za-z0-9À-ž'-]+/g)?.length || 1;
  const punctuationPause = (sentence.match(/[,:;—-]/g) || []).length * 0.8;
  return Math.max(1, words + punctuationPause + 1.2);
}

function makeCumulative(weights) {
  let sum = 0;
  return weights.map(w => (sum += w));
}

function renderTranscript() {
  transcript.innerHTML = "";
  const fragment = document.createDocumentFragment();

  state.sentences.forEach((sentence, index) => {
    const span = document.createElement("span");
    span.className = "sentence";
    span.dataset.index = index;
    span.innerHTML = tokenizeSentence(sentence);
    span.addEventListener("click", (event) => {
      const wordEl = event.target.closest(".word");
      if (wordEl) {
        openDictionary(wordEl.dataset.word, sentence);
      } else {
        setCurrentSentence(index, true);
      }
    });
    fragment.appendChild(span);
    fragment.append(" ");
  });

  transcript.appendChild(fragment);
  updateCounter();
}

function tokenizeSentence(sentence) {
  const escaped = escapeHtml(sentence);
  return escaped.replace(
    /([A-Za-zÀ-ž]+(?:['’\-][A-Za-zÀ-ž]+)*)/g,
    '<span class="word" data-word="$1">$1</span>'
  );
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function rebuildTimeline() {
  updateHighlightFromAudio();
}

function estimatedIndexAtTime(time) {
  const duration = audioPlayer.duration;
  if (!Number.isFinite(duration) || duration <= 0 || state.sentences.length === 0) return 0;

  const anchors = [
    { index: 0, time: 0 },
    ...state.manualAnchors,
    { index: state.sentences.length, time: duration }
  ].sort((a, b) => a.index - b.index || a.time - b.time);

  let left = anchors[0];
  let right = anchors[anchors.length - 1];

  for (let i = 0; i < anchors.length - 1; i++) {
    if (time >= anchors[i].time && time <= anchors[i + 1].time) {
      left = anchors[i];
      right = anchors[i + 1];
      break;
    }
  }

  const startIndex = Math.min(left.index, state.sentences.length - 1);
  const endIndex = Math.max(startIndex + 1, Math.min(right.index, state.sentences.length));
  const rangeWeights = state.weights.slice(startIndex, endIndex);
  const total = rangeWeights.reduce((a, b) => a + b, 0) || 1;
  const progress = Math.max(0, Math.min(1, (time - left.time) / Math.max(0.001, right.time - left.time)));
  const target = total * progress;

  let running = 0;
  for (let i = startIndex; i < endIndex; i++) {
    running += state.weights[i];
    if (target <= running) return i;
  }
  return Math.max(0, endIndex - 1);
}

function updateHighlightFromAudio() {
  if (!state.sentences.length) return;
  setCurrentSentence(estimatedIndexAtTime(audioPlayer.currentTime), false);
}

function setCurrentSentence(index, seekAudio) {
  if (!state.sentences.length) return;
  index = Math.max(0, Math.min(index, state.sentences.length - 1));

  const old = transcript.querySelector(".sentence.current");
  old?.classList.remove("current");

  const current = transcript.querySelector(`.sentence[data-index="${index}"]`);
  current?.classList.add("current");
  state.currentIndex = index;
  updateCounter();

  if (current) {
    const containerRect = transcript.getBoundingClientRect();
    const itemRect = current.getBoundingClientRect();
    if (itemRect.top < containerRect.top + 40 || itemRect.bottom > containerRect.bottom - 40) {
      current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (seekAudio && Number.isFinite(audioPlayer.duration)) {
    audioPlayer.currentTime = estimatedTimeForIndex(index);
  }
}

function estimatedTimeForIndex(index) {
  const duration = audioPlayer.duration;
  if (!Number.isFinite(duration) || duration <= 0) return 0;

  const anchors = [
    { index: 0, time: 0 },
    ...state.manualAnchors,
    { index: state.sentences.length, time: duration }
  ].sort((a, b) => a.index - b.index);

  let left = anchors[0];
  let right = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (index >= anchors[i].index && index <= anchors[i + 1].index) {
      left = anchors[i];
      right = anchors[i + 1];
      break;
    }
  }

  const start = left.index;
  const end = Math.max(start + 1, right.index);
  const before = state.weights.slice(start, index).reduce((a,b) => a+b, 0);
  const total = state.weights.slice(start, end).reduce((a,b) => a+b, 0) || 1;
  return left.time + (right.time - left.time) * (before / total);
}

function syncCurrentSentenceHere() {
  if (state.currentIndex < 0 || !Number.isFinite(audioPlayer.duration)) {
    return showToast("Play the audio and select a sentence first.");
  }

  state.manualAnchors = state.manualAnchors.filter(a => a.index !== state.currentIndex);
  state.manualAnchors.push({ index: state.currentIndex, time: audioPlayer.currentTime });
  state.manualAnchors.sort((a, b) => a.index - b.index);
  showToast(`Sentence ${state.currentIndex + 1} synced at ${formatTime(audioPlayer.currentTime)}.`);
}

function applySearch() {
  const query = searchInput.value.trim().toLowerCase();
  transcript.querySelectorAll(".sentence").forEach(el => {
    el.classList.toggle("search-match", Boolean(query) && el.textContent.toLowerCase().includes(query));
  });

  if (query) {
    const first = transcript.querySelector(".sentence.search-match");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

async function openDictionary(word, sentence) {
  const cleanWord = word.replace(/[^A-Za-zÀ-ž'-]/g, "");
  dictionaryPopup.hidden = false;
  dictionaryWord.textContent = cleanWord;
  dictionaryMeaning.textContent = "Loading…";
  dictionaryContext.textContent = `In the lesson: “${sentence}”`;

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
    if (!response.ok) throw new Error("Not found");
    const data = await response.json();
    const definition = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
    dictionaryMeaning.textContent = definition || "No simple definition was found.";
  } catch {
    dictionaryMeaning.textContent = "No definition was found. Check the spelling or internet connection.";
  }
}

function updateCounter() {
  sentenceCounter.textContent = state.sentences.length
    ? `${state.currentIndex + 1} / ${state.sentences.length}`
    : "0 / 0";
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

let toastTimer;
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.hidden = true, 2400);
}
