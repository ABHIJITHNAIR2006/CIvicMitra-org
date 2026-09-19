import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { QuizQuestion } from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import DashboardLayout from "../layouts/DashboardLayout";
import { Plus, Trash2, Edit2, Save, X, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmModal from "../components/ConfirmModal";
import { checkIsAdmin } from "../lib/auth-utils";

const PRESEED_QUESTIONS: Omit<QuizQuestion, 'id'>[] = [
  {
    "question": "Which action helps save electricity at home?",
    "options": [
      "Leaving lights on when not in use",
      "Using LED bulbs",
      "Keeping TV on all day",
      "Charging devices overnight unnecessarily"
    ],
    "correctAnswer": 1,
    "difficulty": "easy"
  },
  {
    "question": "What is the best way to save water while brushing teeth?",
    "options": [
      "Keep tap running",
      "Use a bucket",
      "Turn off tap while brushing",
      "Use more water"
    ],
    "correctAnswer": 2,
    "difficulty": "easy"
  },
  {
    "question": "Which method saves fuel the most?",
    "options": [
      "Driving alone daily",
      "Carpooling",
      "Using bigger vehicles",
      "Keeping engine running at signals"
    ],
    "correctAnswer": 1,
    "difficulty": "easy"
  },
  {
    "question": "What does switching off appliances at the plug save?",
    "options": [
      "Nothing",
      "Water",
      "Electricity",
      "Fuel"
    ],
    "correctAnswer": 2,
    "difficulty": "easy"
  },
  {
    "question": "Which is the most energy-efficient lighting option?",
    "options": [
      "Incandescent bulbs",
      "Halogen lamps",
      "LED lights",
      "Tube lights"
    ],
    "correctAnswer": 2,
    "difficulty": "medium"
  },
  {
    "question": "What is a good way to save water in gardening?",
    "options": [
      "Watering plants at noon",
      "Using sprinklers all day",
      "Watering early morning or evening",
      "Using excessive water"
    ],
    "correctAnswer": 2,
    "difficulty": "medium"
  },
  {
    "question": "Which practice helps conserve electricity?",
    "options": [
      "Opening fridge frequently",
      "Keeping AC at 16°C always",
      "Using natural light during the day",
      "Running fans in empty rooms"
    ],
    "correctAnswer": 2,
    "difficulty": "easy"
  },
  {
    "question": "What is the benefit of using public transport?",
    "options": [
      "Increases pollution",
      "Saves fuel and reduces emissions",
      "Wastes time always",
      "Consumes more resources"
    ],
    "correctAnswer": 1,
    "difficulty": "easy"
  },
  {
    "question": "Which appliance consumes less electricity?",
    "options": [
      "Old refrigerator",
      "Energy-efficient (5-star rated) appliance",
      "Heater",
      "Air conditioner"
    ],
    "correctAnswer": 1,
    "difficulty": "medium"
  },
  {
    "question": "What is the best way to reduce water wastage at home?",
    "options": [
      "Ignoring leaks",
      "Fixing leaking taps",
      "Using more water",
      "Letting taps drip"
    ],
    "correctAnswer": 1,
    "difficulty": "easy"
  },
  {
    "question": "Which habit saves electricity?",
    "options": [
      "Leaving chargers plugged in",
      "Turning off devices when not in use",
      "Using devices continuously",
      "Keeping lights on all night"
    ],
    "correctAnswer": 1,
    "difficulty": "easy"
  },
  {
    "question": "What is an eco-friendly way to travel short distances?",
    "options": [
      "Using a car",
      "Using a bike or walking",
      "Taking a taxi",
      "Driving alone"
    ],
    "correctAnswer": 1,
    "difficulty": "easy"
  },
  {
    "question": "Which method helps save paper?",
    "options": [
      "Printing everything",
      "Using both sides of paper",
      "Throwing unused paper",
      "Avoiding recycling"
    ],
    "correctAnswer": 1,
    "difficulty": "easy"
  },
  {
    "question": "What is the main benefit of rainwater harvesting?",
    "options": [
      "Wastes water",
      "Stores water for future use",
      "Increases pollution",
      "Consumes energy"
    ],
    "correctAnswer": 1,
    "difficulty": "medium"
  },
  {
    "question": "Which practice saves fuel in vehicles?",
    "options": [
      "Sudden acceleration",
      "Maintaining steady speed",
      "Frequent braking",
      "Overloading vehicle"
    ],
    "correctAnswer": 1,
    "difficulty": "medium"
  },
  {
    "question": "Which of these reduces electricity usage?",
    "options": [
      "Using old appliances",
      "Unplugging unused electronics",
      "Running appliances continuously",
      "Ignoring power usage"
    ],
    "correctAnswer": 1,
    "difficulty": "easy"
  },
  {
    "question": "What is a sustainable way to wash clothes?",
    "options": [
      "Running half-load washing machine",
      "Using full load efficiently",
      "Using excessive detergent",
      "Washing daily small loads"
    ],
    "correctAnswer": 1,
    "difficulty": "medium"
  },
  {
    "question": "Which of the following saves natural resources?",
    "options": [
      "Recycling materials",
      "Throwing waste anywhere",
      "Burning plastic",
      "Using single-use items"
    ],
    "correctAnswer": 0,
    "difficulty": "easy"
  },
  {
    "question": "What is the best way to reduce energy consumption in summer?",
    "options": [
      "Using AC at lowest temperature",
      "Using fans and ventilation",
      "Keeping doors open with AC on",
      "Running AC all day"
    ],
    "correctAnswer": 1,
    "difficulty": "medium"
  },
  {
    "question": "Which action helps save both water and energy?",
    "options": [
      "Long hot showers",
      "Short showers",
      "Leaving tap open",
      "Using more hot water"
    ],
    "correctAnswer": 1,
    "difficulty": "easy"
  }
];

export default function AdminQuizManager() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState<Omit<QuizQuestion, 'id'>>({
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    difficulty: "easy"
  });

  const fetchQuestions = async () => {
    try {
      const snap = await getDocs(collection(db, "quiz_questions")).catch(e => handleFirestoreError(e, OperationType.LIST, "quiz_questions"));
      if (snap) {
        setQuestions(snap.docs
          .map(d => ({ id: d.id, ...d.data() } as QuizQuestion))
          .filter(q => q && q.question)
        );
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (checkIsAdmin(null, user.email)) {
        setIsAdmin(true);
        fetchQuestions();
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && checkIsAdmin(userDoc.data().role, user.email)) {
          setIsAdmin(true);
          fetchQuestions();
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  const handleAddQuestion = async () => {
    if (!newQuestion.question || newQuestion.options.some(o => !o)) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      await addDoc(collection(db, "quiz_questions"), newQuestion).catch(e => handleFirestoreError(e, OperationType.CREATE, "quiz_questions"));
      toast.success("Question added!");
      setNewQuestion({ question: "", options: ["", "", "", ""], correctAnswer: 0, difficulty: "easy" });
      fetchQuestions();
    } catch (error) {
      toast.error("Failed to add question");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "quiz_questions", id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `quiz_questions/${id}`));
      toast.success("Deleted");
      fetchQuestions();
    } catch (error) {
      toast.error("Failed to delete");
    } finally {
      setQuestionToDelete(null);
    }
  };

  const handleSeed = async () => {
    console.log("PRESEED_QUESTIONS:", PRESEED_QUESTIONS);
    // Use a simpler check instead of window.confirm which might be blocked in iframe
    const confirmSeed = true; // For now, let's bypass or use a better UI later
    if (!confirmSeed) return;
    
    try {
      const batch = writeBatch(db);
      console.log("Starting batch creation...");
      
      PRESEED_QUESTIONS.forEach((q, index) => {
        const newDoc = doc(collection(db, "quiz_questions"));
        batch.set(newDoc, q);
        console.log(`Added question ${index + 1} to batch`);
      });
      
      console.log("Committing batch...");
      await batch.commit();
      console.log("Batch committed successfully!");
      
      toast.success("Seeded 20 questions!");
      await fetchQuestions();
    } catch (error: any) {
      console.error("Seeding failed with error:", error);
      handleFirestoreError(error, OperationType.WRITE, "quiz_questions (batch)");
      toast.error("Seeding failed. Check console for details.");
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-bold text-red-500">Access Denied</h1>
        <p className="text-text-secondary">You do not have administrative privileges to access this area.</p>
        <button onClick={() => window.history.back()} className="px-8 py-3 bg-primary text-white rounded-xl font-bold">Go Back</button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Quiz Question Manager</h1>
          <button 
            onClick={handleSeed}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent/90 transition-all"
          >
            <RefreshCw size={18} />
            Seed 20 Questions
          </button>
        </div>

        {/* Add Question Form */}
        <div className="bg-card p-6 rounded-3xl card-shadow space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-text-primary">
            <Plus className="text-primary" /> Add New Question
          </h2>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Question text"
              className="w-full p-3 bg-primary/5 border border-primary/10 rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-primary"
              value={newQuestion.question}
              onChange={e => setNewQuestion({...newQuestion, question: e.target.value})}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newQuestion.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="correct" 
                    checked={newQuestion.correctAnswer === i}
                    onChange={() => setNewQuestion({...newQuestion, correctAnswer: i})}
                    className="accent-primary"
                  />
                  <input 
                    type="text" 
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 p-3 bg-primary/5 border border-primary/10 rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-primary"
                    value={opt}
                    onChange={e => {
                      const newOpts = [...newQuestion.options];
                      newOpts[i] = e.target.value;
                      setNewQuestion({...newQuestion, options: newOpts});
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4">
              <select 
                className="p-3 bg-primary/5 border border-primary/10 rounded-xl outline-none text-text-primary"
                value={newQuestion.difficulty}
                onChange={e => setNewQuestion({...newQuestion, difficulty: e.target.value as any})}
              >
                <option value="easy" className="bg-card">Easy</option>
                <option value="medium" className="bg-card">Medium</option>
                <option value="hard" className="bg-card">Hard</option>
              </select>
              <button 
                onClick={handleAddQuestion}
                className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-all"
              >
                Add Question
              </button>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary">Question Bank ({questions.length})</h2>
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-32 bg-primary/5 rounded-3xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {questions.map(q => (
                <div key={q.id} className="bg-card p-6 rounded-3xl card-shadow flex justify-between items-start group">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        q.difficulty === 'easy' ? 'bg-green-500/10 text-green-500' :
                        q.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {q.difficulty}
                      </span>
                      <h3 className="font-bold text-text-primary">{q.question}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-text-secondary">
                      {q.options.map((opt, i) => (
                        <div key={i} className={i === q.correctAnswer ? "text-primary font-bold" : ""}>
                          {i + 1}. {opt} {i === q.correctAnswer && "✓"}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => q.id && setQuestionToDelete(q.id)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmModal
          isOpen={!!questionToDelete}
          onClose={() => setQuestionToDelete(null)}
          onConfirm={() => questionToDelete && handleDelete(questionToDelete)}
          title="Delete Question"
          message="Are you sure you want to delete this quiz question? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </DashboardLayout>
  );
}
