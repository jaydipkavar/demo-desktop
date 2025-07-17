import { db, initializeDB } from "@/db";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export async function logoutCleanUp() {
    // Clear local storage
    localStorage.clear();

    // clear IndexedDB if needed
    await db.delete();
    initializeDB();
}
