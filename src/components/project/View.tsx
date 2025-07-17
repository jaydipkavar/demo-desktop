"use client";

import {
    ArrowLeft,
    Play,
    Pause,
    Settings,
    Download,
    Share,
    MoreHorizontal,
    Mouse,
    Keyboard,
    CornerDownLeft,
    Clock,
    Globe,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchFromIndexedDB } from "@/lib/indexedDbUtil";
import { PROCESS_HTML_URL } from "@/lib/constants";
import { useNavigate } from "react-router-dom";

interface ISteps {
    action: string;
    element_name: string;
    keyboard_input: string | null;
    step_id: number;
    url: string;
}

interface ProjectViewProps {
    steps: ISteps[];
    project: {
        base_url: string;
        created_at: string;
        number_of_steps: number;
        session_id: number;
        session_name: string;
        updated_at: string;
    };
}

const getActionIcon = (type: string) => {
    switch (type) {
        case "navigation":
            return <Globe className="w-4 h-4 text-gray-600" />;
        case "click":
            return <Mouse className="w-4 h-4 text-gray-600" />;
        case "typed":
            return <Keyboard className="w-4 h-4 text-gray-600" />;
        case "enter":
            return <CornerDownLeft className="w-4 h-4 text-gray-600" />;
        case "wait":
            return <Clock className="w-4 h-4 text-gray-600" />;
        default:
            return <Mouse className="w-4 h-4 text-gray-600" />;
    }
};

const getActionLabel = (type: string) => {
    switch (type) {
        case "navigation":
            return "NAVIGATE";
        case "click":
            return "CLICK";
        case "typed":
            return "TYPED";
        case "enter":
            return "ENTER";
        case "wait":
            return "WAIT";
        default:
            return "ACTION";
    }
};

const getPlatformIcon = (platform: string) => {
    return (
        <img
            src={`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${platform}&size=128 `}
            className="w-14"
        />
    );
};

export function ProjectView({ steps, project }: ProjectViewProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [stepStatuses, setStepStatuses] = useState(
        Array(steps.length).fill("pending")
    );
    const [screenshots, setScreenshots] = useState<any[]>([]);
    const navigate = useNavigate();
    const [stepTimes, setStepTimes] = useState(Array(steps.length).fill(null));
    async function drawCircleOnBase64Image(
        base64Image,
        box,
        color = "orange",
        radius = 15
    ) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                // Calculate center of the box
                const centerX = box.x + box.width / 2;
                const centerY = box.y + box.height / 2;

                // Draw circle (zoom-style highlight)
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
                ctx.lineWidth = 4;
                ctx.strokeStyle = color;
                ctx.fillStyle = "rgba(255, 165, 0, 0.3)"; // semi-transparent orange
                ctx.fill();
                ctx.stroke();

                resolve(canvas.toDataURL("image/png"));
            };
            img.src = base64Image;
        });
    }

    const runAutomation = async () => {
        setIsPlaying(true);
        let prevUrl = null;

        // Fetch user details from IndexedDB
        const accessToken = await fetchFromIndexedDB(
            "agentActAuthDB",
            "tokens",
            "accessToken"
        );

        for (let i = 0; i < steps.length; i++) {
            const result = await window.electronAPI.waitForPage();
            if (result.success) {
                console.log("Page is fully loaded");
            } else {
                console.error("Page load failed:", result.message);
            }
            const step = steps[i];
            const session_id = project.session_id;
            // Only navigate if URL changes
            if (step.url !== prevUrl) {
                await window.electronAPI.launchPlaywright(step.url);
                console.log(`Navigating to: ${step.url}`);
                prevUrl = step.url;
            }

            // Get HTML content
            const {
                content: htmlContent,
                width,
                height,
            } = await window.electronAPI.getPageContent();
            console.log(
                "HTML Content fetched successfully",
                width,
                height,
                htmlContent
            );
            setCurrentStep(i);
            const startTime = Date.now();
            // Call your API to get the action object
            try {
                const payload = {
                    session_id,
                    step_id: step.step_id,
                    viewport_height: 857,
                    viewport_width: 1106,
                    html: htmlContent,
                };
                const response = await window.api.fetch(PROCESS_HTML_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify(payload),
                });
                const actionObj = await response.data;
                console.log("Action Object Payload:", payload);
                console.log("Action Object:", actionObj);

                // Perform the action
                const actionResponse = await window.electronAPI.performAction(
                    actionObj
                );
                console.log("------currentStep", currentStep);
                console.log(actionResponse);
                const base64Image = actionResponse.img;
                if (base64Image) {
                    const imageSrc = `data:image/png;base64,${base64Image}`;

                    // Draw box if elementInfo.box exists and current step isn't 9
                    if (actionResponse.elementInfo?.box) {
                        const imageWithBox = await drawCircleOnBase64Image(
                            imageSrc,
                            actionResponse.elementInfo.box
                        );
                        setScreenshots((prev) => [...prev, imageWithBox]);
                    } else {
                        // Just show the raw image without drawing
                        setScreenshots((prev) => [...prev, imageSrc]);
                    }
                }

                if (actionResponse.success) {
                    const endTime = Date.now();
                    const duration = Math.round((endTime - startTime) / 1000);
                    console.log(
                        `Step ${i + 1} executed successfully`,
                        actionResponse.message
                    );
                    setStepStatuses((prev) =>
                        prev.map((s, idx) => (idx === i ? "completed" : s))
                    );
                    setStepTimes((prev) =>
                        prev.map((t, idx) => (idx === i ? duration : t))
                    );
                } else {
                    const endTime = Date.now(); // ⏱️ stop
                    const duration = Math.round((endTime - startTime) / 1000);
                    console.error(
                        `Error executing step ${i + 1}:`,
                        actionResponse.message
                    );
                    setStepStatuses((prev) =>
                        prev.map((s, idx) => (idx === i ? "failed" : s))
                    );

                    setStepTimes((prev) =>
                        prev.map((t, idx) => (idx === i ? duration : t))
                    );
                }
            } catch (error) {
                const endTime = Date.now();
                const duration = Math.round((endTime - startTime) / 1000);
                console.error(`Step ${i + 1} failed with exception:`, error);
                setStepStatuses((prev) =>
                    prev.map((s, idx) => (idx === i ? "failed" : s))
                );

                setStepTimes((prev) =>
                    prev.map((t, idx) => (idx === i ? duration : t))
                );
            }

            // Update UI

            // Optional: add a delay if needed
            await new Promise((res) => setTimeout(res, 500));
        }

        setIsPlaying(false);
    };

    console.log("steps", steps);

    const handlePlay = async () => {
        setIsPlaying(!isPlaying);

        if (!isPlaying) {
            setCurrentStep(0);
            setScreenshots([]);
            setStepStatuses(
                steps.map((_, index) => (index === 0 ? "pending" : "idle"))
            );
            runAutomation();
            console.log("Starting automation...");
        } else {
            const response = await window.electronAPI.closePlaywright();

            console.log("Pausing automation...", response);
        }
    };

    const handleStepClick = (stepIndex: number) => {
        setCurrentStep(stepIndex);
        console.log(`Jumping to step ${stepIndex + 1}`);
    };
    async function handleBackToDashboard() {
        navigate("/");
        const response = await window.electronAPI.closePlaywright();
        console.log("Pausing automation...", response);
    }
    return (
        <div className="h-full bg-[#f7f9fa] flex flex-col">
            {/* Project Header */}
            <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleBackToDashboard}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        {/* Project info with platform branding */}
                        <div className="flex items-center gap-3">
                            {getPlatformIcon(project.base_url)}
                            <div>
                                <h1 className="text-lg font-semibold text-black">
                                    {project.session_name}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {project.base_url} •{" "}
                                    {project.number_of_steps} steps
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handlePlay}
                            className={`${
                                isPlaying
                                    ? "bg-red-600 hover:bg-red-700"
                                    : "bg-black hover:bg-gray-800"
                            } text-white`}
                        >
                            {isPlaying ? (
                                <>
                                    <Pause className="w-4 h-4 mr-2" />
                                    Stop
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Play
                                </>
                            )}
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                    <Settings className="w-4 h-4 mr-2" />
                                    Edit Project
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Share className="w-4 h-4 mr-2" />
                                    Share
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex px-6 pb-6 gap-0 overflow-hidden">
                {/* Sticky Steps Panel */}
                <div className="w-96 bg-white border border-[#e4e6eb] rounded-l-lg flex flex-col sticky top-0 h-full">
                    <div className="p-6 border-b border-[#e4e6eb]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-black">
                                Activity Log
                            </h2>
                            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                {steps.length} events
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {steps.length &&
                            steps?.map((step, index) => {
                                const status = stepStatuses[index];
                                return (
                                    <Card
                                        key={step.step_id}
                                        onClick={() => handleStepClick(index)}
                                        className={`p-4 cursor-pointer transition-all duration-200 border relative ${
                                            currentStep === index
                                                ? "border-blue-200 bg-blue-50 shadow-sm"
                                                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1 ${
                                                    status === "current"
                                                        ? "bg-blue-100 text-blue-700"
                                                        : status === "completed"
                                                        ? "bg-green-100 text-green-700"
                                                        : status === "failed"
                                                        ? "bg-red-100 text-red-700"
                                                        : "bg-gray-100 text-gray-600"
                                                }`}
                                            >
                                                {index + 1}
                                            </div>
                                            <div className="flex-shrink-0 mt-1">
                                                {getActionIcon(step.action)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-semibold text-sm text-black">
                                                        {getActionLabel(
                                                            step.action
                                                        )}
                                                    </span>
                                                    <span className="text-sm text-gray-500 font-mono truncate">
                                                        {step.element_name}
                                                    </span>
                                                </div>
                                                {step.keyboard_input && (
                                                    <div className="text-sm text-gray-600">
                                                        <span className="text-gray-500">
                                                            Input:
                                                        </span>{" "}
                                                        <span className="font-mono">
                                                            {
                                                                step.keyboard_input
                                                            }
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="flex-1 bg-white border-t border-r border-b border-[#e4e6eb] rounded-r-lg flex flex-col h-full">
                    <div className="p-4 border-b border-[#e4e6eb]">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-medium text-black">
                                Step Preview
                            </h3>
                            <div className="text-sm text-gray-500">
                                Step {currentStep + 1} of {steps.length}
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="flex items-center gap-3 mb-3">
                                {getActionIcon(steps[currentStep]?.action)}
                                <h4 className="font-semibold text-black">
                                    {getActionLabel(steps[currentStep]?.action)}
                                </h4>
                                {steps.map((step, index) => {
                                    const status = stepStatuses[index]; // 'success' | 'error' | 'pending'
                                    const isCurrent = index === currentStep;

                                    const statusClass =
                                        status === "completed"
                                            ? "bg-green-100 text-green-700"
                                            : status === "failed"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-gray-100 text-gray-600";

                                    const statusLabel =
                                        status === "completed"
                                            ? "Successful"
                                            : status === "failed"
                                            ? "Failed"
                                            : "Pending";

                                    return (
                                        isCurrent && (
                                            <>
                                                {" "}
                                                <div
                                                    key={index}
                                                    className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass}`}
                                                >
                                                    {statusLabel}
                                                </div>
                                                <div className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                    {stepTimes[index] != null
                                                        ? `${stepTimes[index]}s`
                                                        : "--"}
                                                </div>
                                            </>
                                        )
                                    );
                                })}
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="text-gray-500">
                                        Element:
                                    </span>
                                    <span className="ml-2 font-mono text-black bg-gray-100 px-2 py-1 rounded text-xs">
                                        {steps[currentStep]?.element_name}
                                    </span>
                                </div>
                                {steps[currentStep]?.keyboard_input && (
                                    <div>
                                        <span className="text-gray-500">
                                            Input Value:
                                        </span>
                                        <span className="ml-2 font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">
                                            {steps[currentStep]?.keyboard_input}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1  flex items-center justify-center overflow-hidden">
                        {screenshots[currentStep] ? (
                            <div className="rounded shadow p-2 border max-w-full">
                                <p className="text-xs text-gray-500 mb-1">
                                    Step {currentStep + 1}
                                </p>
                                <img
                                    src={screenshots[currentStep]}
                                    alt={`Step ${currentStep + 1}`}
                                    className="w-full h-[550px] object-contain rounded bg-white"
                                />
                            </div>
                        ) : (
                            <>
                                {" "}
                                <div className="rounded shadow p-2 border max-w-full flex items-center justify-center  bg-white text-gray-400">
                                    No screenshot available for Step{" "}
                                    {currentStep + 1}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex items-center justify-between p-6 border-t border-[#e4e6eb] bg-white">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setCurrentStep(Math.max(0, currentStep - 1))
                            }
                            disabled={currentStep === 0}
                        >
                            Previous
                        </Button>
                        <div className="text-sm text-gray-500">
                            {currentStep + 1} / {steps.length}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setCurrentStep(
                                    Math.min(steps.length - 1, currentStep + 1)
                                )
                            }
                            disabled={currentStep === steps.length - 1}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
