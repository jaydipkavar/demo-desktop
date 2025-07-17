import { ProjectView } from "@/components/project";
import { DashboardSidebar } from "@/components/sidebar";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { SESSION_DETAIL_URL } from "@/lib/constants";
import { toast } from "@/components/ui/sonner";
import { fetchFromIndexedDB } from "@/lib/indexedDbUtil";
import { logoutCleanUp } from "@/lib/utils";
import AgentLoader from "@/components/Loader";

interface IProjects {
    base_url: string;
    created_at: string;
    number_of_steps: number;
    session_id: number;
    session_name: string;
    updated_at: string;
}

function Detail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState<IProjects>();
    const [steps, setProjectSteps] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        // If navigation state contains project, use it directly
        const navState = window.history.state?.usr;
        if (navState && navState.project) {
            setSelectedProject(navState.project);
        }
    }, []);
    useEffect(() => {
        if (id) {
            const triggerApi = async () => {
                setIsLoading(true);
                const accessToken = await fetchFromIndexedDB(
                    "agentActAuthDB",
                    "tokens",
                    "accessToken"
                );
                const response = await window.api.fetch(
                    SESSION_DETAIL_URL(parseInt(id || "")),
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );
                if (response.ok) {
                    if (response.data?.msg === "Token has expired") {
                        toast.error(response.data.msg, {
                            richColors: true,
                        });
                        logoutCleanUp();
                        navigate("/login");
                        return;
                    }
                    setProjectSteps(response.data);
                } else {
                    toast.error(response?.error || "Something went wrong");
                }
                setIsLoading(false);
            };

            triggerApi();
        }
    }, [id]);

    return (
        <>
            <div className="flex h-screen bg-[#f7f9fa]">
                <DashboardSidebar collapsed={true} />

                {isLoading && <AgentLoader />}
                {!isLoading && selectedProject && (
                    <div className="flex-1 flex flex-col">
                        <ProjectView project={selectedProject} steps={steps} />
                    </div>
                )}
            </div>
        </>
    );
}

export default Detail;
