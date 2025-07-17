import { useEffect } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Detail from "./pages/Detail";
import { fetchFromIndexedDB, storeInIndexedDB } from "./lib/indexedDbUtil";
import { REFRESH_TOKEN_URL } from "./lib/constants";
import { db, initializeDB } from "./db";

function App() {
    const navigate = useNavigate();
    const refreshToken = async () => {
        const refreshToken = await fetchFromIndexedDB(
            "agentActAuthDB",
            "tokens",
            "refreshToken"
        );
        if (refreshToken) {
            const response = await window.api.fetch(REFRESH_TOKEN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${refreshToken}`,
                },
            });
            if (response.ok) {
                await Promise.all([
                    storeInIndexedDB(
                        "agentActAuthDB",
                        "tokens",
                        "accessToken",
                        response.data.access_token
                    ),
                    storeInIndexedDB(
                        "agentActAuthDB",
                        "tokens",
                        "refreshToken",
                        response.data.refresh_token
                    ),
                ]);
            }
        }
    };

    const checkLogin = async () => {
        const isLoggedIn = !!window.localStorage?.getItem?.("isLoggedIn") && await db.tokens.get("accessToken");
        initializeDB();
        if (isLoggedIn) {
            const interval = setInterval(() => {
                refreshToken();
            }, 1000 * 60 * 9); // Refresh token every 9 minutes
            return () => clearInterval(interval);
        } else {
            // User is not logged in, redirect to login page
            navigate("/login");
        }
    }
    useEffect(() => {
        checkLogin();
    }, []);

    return (
        <div className="w-full h-screen">
            <Toaster position="top-right" />
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/detail/:id" element={<Detail />} />
            </Routes>
        </div>
    );
}

export default App;
