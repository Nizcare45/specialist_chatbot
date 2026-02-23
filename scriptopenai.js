const chat = document.getElementById("chat-messages");
const input = document.getElementById("user-input");
const send = document.getElementById("send-button");

function scrollToBottom() {
    setTimeout(() => chat.scrollTop = chat.scrollHeight, 50);
}

// TTS State
let currentUtterance = null;
let isSpeaking = false;
let voices = [];

function loadVoices() {
    voices = window.speechSynthesis.getVoices().filter(v =>
        v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("woman") ||
        v.name.toLowerCase().includes("samantha") ||
        v.name.toLowerCase().includes("kate") ||
        v.name.toLowerCase().includes("google us english") ||
        v.voiceURI.toLowerCase().includes("female")
    );
}

window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function addMessage(text, sender) {
    const msg = document.createElement("div");
    msg.className = `message ${sender}-message`;

    if (sender === "bot") {
        msg.innerHTML = `
            <div class="bot-content">${text}</div>
            <button class="speaker-btn">🔊</button>
        `;
        const speakerBtn = msg.querySelector(".speaker-btn");

        speakerBtn.onclick = () => {
            const spokenText = msg.querySelector(".bot-content").innerText;

            if (voices.length === 0) {
                alert("⚠️ No female voice available on this device yet. Please try again in a moment.");
                return;
            }

            if (isSpeaking) {
                window.speechSynthesis.cancel();
                isSpeaking = false;
                speakerBtn.innerHTML = "🔊";
                return;
            }

            currentUtterance = new SpeechSynthesisUtterance(spokenText);
            currentUtterance.voice = voices[0];
            currentUtterance.lang = voices[0].lang;

            isSpeaking = true;
            speakerBtn.innerHTML = "⏹️";

            currentUtterance.onend = () => {
                isSpeaking = false;
                speakerBtn.innerHTML = "🔊";
            };

            window.speechSynthesis.speak(currentUtterance);
        };

    } else {
        msg.textContent = text;
    }

    chat.appendChild(msg);
    scrollToBottom();
}

function showTyping() {
    const t = document.createElement("div");
    t.className = "typing";
    t.id = "typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    chat.appendChild(t);
    scrollToBottom();
}

function hideTyping() {
    const t = document.getElementById("typing");
    if (t) t.remove();
}

// ----- OpenAI Configuration -----
const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY"; // Replace with your key
let conversationHistory = [];

// ----- Chatbot Call -----
async function callOpenAI(userMsg) {
    // Add user message to conversation
    conversationHistory.push({ role: "user", content: userMsg });

    const systemPrompt = `
You are a MENTAL HEALTH & PSYCHOLOGY intake assistant.

RULES:
1. Only respond to mental health/psychology info.
2. Collect exactly 5 intake answers in this order:
   - Symptoms
   - Duration
   - Impact on daily life
   - Previous similar experience
   - Current therapy/medications
3. If user mentions suicidal thoughts, self-harm, or harming others, instruct them to contact emergency services immediately.
4. After 5 answers, return an HTML summary exactly formatted as:
<div class="section" style="margin-left:20px;">
  <h3>Mental Health Summary</h3>
  <ul>
    <li>[summary point 1]</li>
    <li>[summary point 2]</li>
    <li>[summary point 3]</li>
  </ul>
</div>
<div class="section" style="margin-left:20px;">
  <h3>Possible Psychological Considerations</h3>
  <ul>
    <li>[consideration 1]</li>
    <li>[consideration 2]</li>
    <li>[consideration 3]</li>
  </ul>
</div>
<div class="section" style="margin-left:20px;">
  <h3>Support & Next Steps</h3>
  <ul>
    <li>[support 1]</li>
    <li>[support 2]</li>
    <li>[support 3]</li>
  </ul>
</div>
5. Must return valid HTML, no markdown, no extra commentary.
6. Always prioritize safety and encourage professional support if symptoms are severe.
`;

    // Build messages for OpenAI
    const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory
    ];

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: messages,
                temperature: 0.7
            })
        });

        const data = await res.json();

        if (data.error) return `❌ OpenAI Error: ${data.error.message}`;
        if (!data.choices || !data.choices[0].message)
            return "⚠️ No response from OpenAI.";

        const aiText = data.choices[0].message.content;

        // Add assistant reply to conversation
        conversationHistory.push({ role: "assistant", content: aiText });

        return aiText;

    } catch (err) {
        console.error("❌ OpenAI FETCH ERROR:", err);
        return "❌ Network or API error.";
    }
}

// ----- Send Handler -----
send.onclick = async () => {
    const msg = input.value.trim();
    if (!msg) return;

    addMessage(msg, "user");
    input.value = "";

    showTyping();
    const reply = await callOpenAI(msg);
    hideTyping();

    addMessage(reply, "bot");
};

input.addEventListener("keypress", e => {
    if (e.key === "Enter") send.click();
});

// ----- Greeting -----
setTimeout(() => {
    const greeting = "Hello! I'm your Mental Health & Psychology AI Assistant. Let's begin.\nWhat symptoms are you experiencing?";
    addMessage(greeting, "bot");

    conversationHistory.push({ role: "assistant", content: greeting });
}, 500);