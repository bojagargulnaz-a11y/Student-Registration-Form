// frontend/src/App.jsx
import { useEffect, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

function App() {
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [newHabit, setNewHabit] = useState('');
  const [loading, setLoading] = useState(true);

  const todayString = () => new Date().toISOString().slice(0, 10);

  const last7Days = () => {
    const days = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      days.push({
        full: d.toISOString().slice(0, 10),
        day: d.getDate()
      });
    }

    return days;
  };

  async function refreshAll() {
    try {
      const habitRes = await fetch(`${API_URL}/habits`);
      const habitData = await habitRes.json();

      setHabits(habitData);

      const map = {};

      for (const habit of habitData) {
        try {
          const res = await fetch(`${API_URL}/habits/${habit.id}/checkins`);
          map[habit.id] = await res.json();
        } catch (err) {
          console.error(err);
        }
      }

      setCheckinsByHabit(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function addHabit() {
    const name = newHabit.trim();

    if (!name) return;

    try {
      await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });

      setNewHabit('');
      await refreshAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function checkIn(id) {
    try {
      await fetch(`${API_URL}/habits/${id}/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      await refreshAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteHabit(id) {
    try {
      await fetch(`${API_URL}/habits/${id}`, {
        method: 'DELETE'
      });

      await refreshAll();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="container">
      <h1>🔥 Habit Tracker</h1>

      <div className="new-habit-card">
        <div className="new-habit-row">
          <input
            placeholder="e.g. Drink 2L water"
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addHabit();
              }
            }}
          />

          <button onClick={addHabit}>
            Add Habit
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading your habits...</p>
      ) : habits.length === 0 ? (
        <p>No habits yet. Add one above to get started!</p>
      ) : (
        habits.map((habit) => {
          const checkins = checkinsByHabit[habit.id] || [];
          const checkedToday = checkins.includes(todayString());

          return (
            <div className="habit-card" key={habit.id}>
              <h3>{habit.name}</h3>

              {habit.streak > 0 ? (
                <p className="streak">
                  🔥 {habit.streak} day streak
                </p>
              ) : (
                <p>No streak yet — check in today!</p>
              )}

              <button
                className="checkin-button"
                disabled={checkedToday}
                onClick={() => checkIn(habit.id)}
              >
                {checkedToday
                  ? '✅ Checked in today'
                  : 'Check In'}
              </button>

              <div className="history">
                {last7Days().map((day) => (
                  <div
                    key={day.full}
                    className={
                      checkins.includes(day.full)
                        ? 'day-box done'
                        : 'day-box'
                    }
                  >
                    {day.day}
                  </div>
                ))}
              </div>

              <button
                className="delete-button"
                onClick={() => deleteHabit(habit.id)}
              >
                Delete Habit
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export default App;