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


const API_KEY = "AIzaSyC2wJRzz4eWYJllO_IEBLpfe-Xoq6f0jzM";
let conversationHistory = [];
let answersCollected = 0;

// GEMINI CALL
async function callGemini(userMsg) {

    conversationHistory.push({
        role: "user",
        text: userMsg
    });

    const instruction = `
<instruction>
You are a DIABETES-ONLY medical intake assistant.

RULES YOU MUST FOLLOW:

1. You must ONLY respond to diabetes-related information.
2. If the user says anything unrelated, reply exactly:
   "I can answer diabetes-related questions only. Please follow the intake questions."
3. You MUST collect exactly 5 diabetes intake answers, in this order:
  
    How long have these symptoms been present?  
    Have you checked your blood sugar recently?  
    Are you taking any diabetes medications?  
    Have you been diagnosed with diabetes before?

4. If the user says YES to blood sugar check → ALWAYS ask:
    "What was the blood sugar level?"

5. ALWAYS:
   • Ask the next question ONLY if previous answer is relevant  
   • If irrelevant → repeat SAME question  

6. AFTER all 5 answers, YOU MUST FORMAT THE RESPONSE EXACTLY LIKE THIS:


<div class="section"style="margin-left:20px;">
  <h3>Diabetes Summary</h3>
  <ul>
    <li>[summary point 1]</li>
    <li>[summary point 2]</li>
    <li>[summary point 3]</li>
  </ul>
</div>

<div class="section" style="margin-left:20px;">
  <h3>Blood Sugar Guidance</h3>
  <ul>
    <li>[guidance 1]</li>
    <li>[guidance 2]</li>
    <li>[guidance 3]</li>
  </ul>
</div>

<div class="section" style="margin-left:20px;">
  <h3>Warning Signs</h3>
  <ul>
    <li>[warning 1]</li>
    <li>[warning 2]</li>
    <li>[warning 3]</li>
  </ul>
</div>

FORMATTING RULES:
- MUST return valid HTML.
- Use <div>, <h3>, <ul>, <li> tags exactly as shown.
- No markdown.
- No paragraphs.
- No extra commentary.
- Do NOT ask more question.

Follow the above formatting EXACTLY.

7. ALWAYS prioritize patient safety and advise to seek emergency care if symptoms are severe.
8. If the user asks any additional questions in context to diabetes, answer them briefly after the formatted response.
</instruction>
`;

    // Build full history in Gemini format
    const contents = [
        {
            role: "user",
            parts: [
                {
                    text: instruction + "\n\nUser conversation begins now:"
                }
            ]
        },
        ...conversationHistory.map(m => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }]
        }))
    ];

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gemini-2.0-flash",
                    contents: contents
                })
            }
        );

        const data = await res.json();
        console.log("📌 RAW GEMINI RESPONSE:", data);

        if (data.error) {
            return `❌ Gemini API Error: ${data.error.message}`;
        }

        if (!data.candidates || !data.candidates[0]) {
            return "⚠️ No response from Gemini.";
        }

        const aiText = data.candidates[0].content.parts[0].text;

        // Store model response
        conversationHistory.push({
            role: "model",
            text: aiText
        });

        return aiText;

    } catch (err) {
        console.error("❌ FETCH ERROR:", err);
        return "❌ Network or API error.";
    }
}

// SEND HANDLER 
send.onclick = async () => {
    const msg = input.value.trim();
    if (!msg) return;

    addMessage(msg, "user");
    input.value = "";

    showTyping();
    const reply = await callGemini(msg);
    hideTyping();

    addMessage(reply, "bot");
};

input.addEventListener("keypress", e => {
    if (e.key === "Enter") send.click();
});

// GREETING 
setTimeout(() => {
    addMessage(
        "Hello! I'm your Diabetes AI Assistant. Let's begin.\nWhat symptoms are you experiencing?",
        "bot"
    );

    conversationHistory.push({
        role: "model",
        text: "What symptoms are you experiencing?"
    });
}, 500);