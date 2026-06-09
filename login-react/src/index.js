import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Login from './Login';
import DeptAttendance from './DeptAttendance';

function App() {
    const [route, setRoute] = useState(window.location.hash);

    useEffect(() => {
        const onHashChange = () => setRoute(window.location.hash);
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    if (route === '#/dept-attendance') {
        return <DeptAttendance />;
    }

    return <Login />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
