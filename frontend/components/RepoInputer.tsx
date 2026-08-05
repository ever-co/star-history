import React, { useEffect, useRef, useState } from "react"
import { head } from "lodash"
import { GITHUB_REPO_URL_REG } from "../helpers/consts"
import toast from "../helpers/toast"
import { useAppStore } from "../store"
import { SketchExternalLinkIcon } from "./SketchIcons"

interface State {
    repo: string
    repos: {
        name: string
        visible: boolean
    }[]
}

interface RepoInputerProps {
    isChartVisible: boolean
    setChartVisibility: React.Dispatch<React.SetStateAction<boolean>>
}

export default function RepoInputer({ setChartVisibility }: RepoInputerProps) {
    const store = useAppStore()
    const [state, setState] = useState<State>({
        repo: "",
        repos: []
    })

    const inputElRef = useRef<HTMLInputElement | null>(null)

    // Ever fork: the "latest blog" lookup fed the promo banner, which is gone.

    useEffect(() => {
        setChartVisibility(true)
    }, [setChartVisibility])

    
    useEffect(() => {
        const hash = window.location.hash;
        if (hash) {
           
            const reposFromHash = hash.substring(1).split('&');
            setState(prev => ({ ...prev, repos: reposFromHash.map(name => ({ name, visible: true })) }));

        }
    }, []);

    

    // Sync local state when store repos change (e.g. from sidebar click)
    useEffect(() => {
        const localNames = state.repos.map(r => r.name)
        const newRepos = store.state.repos.filter(name => !localNames.includes(name))
        if (newRepos.length > 0) {
            setState(prev => ({
                ...prev,
                repos: [
                    ...prev.repos,
                    ...newRepos.map(name => ({ name, visible: true }))
                ]
            }))
        }
    }, [store.state.repos])

    useEffect(() => {
        const handleWatch = () => {
            for (const r of state.repos) {
                if (r.visible && !store.state.repos.includes(r.name)) {
                    setState((prev) => ({
                        ...prev,
                        repos: prev.repos.filter((repo) => repo.name !== r.name)
                    }))
                }
            }

            let hash = ""
            if (store.state.repos.length > 0) {
                const chartModeParam = store.state.chartMode === "Date" ? "date" : "timeline"
                hash = `#${store.state.repos.join("&")}&type=${chartModeParam}`
                if (store.state.useLogScale) {
                    hash += "&logscale"
                }
                hash += `&legend=${store.state.legendPosition}`
            }
            // Sync location hash only right here
            window.location.hash = hash
        }

        handleWatch()
    }, [store.state.repos, store.state.chartMode, store.state.useLogScale, store.state.legendPosition, state.repos])

    const handleAddRepoBtnClick = () => {
        if (store.isFetching) {
            return
        }
        const rawRepos = state.repo
        // Ever fork: upstream defaulted an empty input to "star-history/star-history",
        // which is not on any of our allowlists and would come back 403. Ask instead.
        if (rawRepos === "") {
            toast.warn("Enter a repository, e.g. ever-co/ever-gauzy")
            return
        }

        for (const rawRepo of rawRepos.split(",")) {
            let repo = ""

            if (GITHUB_REPO_URL_REG.test(rawRepo)) {
                repo = (rawRepo.match(GITHUB_REPO_URL_REG) as string[])[1]
            }
            repo = head(rawRepo.split("#")) as string
            if (repo === "") {
                continue
            }

            if (GITHUB_REPO_URL_REG.test(repo)) {
                const regResult = GITHUB_REPO_URL_REG.exec(repo)
                if (regResult && regResult[1]) {
                    repo = regResult[1]
                }
            }

            const valueList = repo.split("/")
            if (valueList.length === 1) {
                repo = `${valueList[0]}/${repo}`
            } else if (valueList.length >= 2) {
                repo = `${valueList[0]}/${valueList[1]}`
            }

            for (const r of state.repos) {
                if (r.name === repo) {
                    if (r.visible) {
                        toast.warn(`Repo ${repo} is already on the chart`)
                    } else {
                        r.visible = true
                        store.actions.setRepos(state.repos.filter((r) => r.visible).map((r) => r.name))
                        setChartVisibility(true)
                    }
                    setState((prev) => ({ ...prev, repo: "" }))
                    return
                }
            }
            setState((prev) => ({
                ...prev,
                repos: [
                    ...prev.repos,
                    {
                        name: repo,
                        visible: true
                    }
                ]
            }))
            store.actions.addRepo(repo)
            setChartVisibility(true)
        }
        setState((prev) => ({ ...prev, repo: "" }))
    }

    const handleToggleRepoItemVisible = React.useCallback(
        (repo: string) => {
            const prevRepos = state.repos
            const newRepos = prevRepos.map((r) => (r.name === repo ? { ...r, visible: !r.visible } : r))
            setState((prev) => ({
                ...prev,
                repos: newRepos
            }))

            // Determine if any repo is visible
            const anyRepoVisible = newRepos.some((r) => r.visible)

            // Set the chart visibility based on whether any repo is visible
            setChartVisibility(anyRepoVisible)

            store.actions.setRepos(newRepos.filter((r) => r.visible).map((r) => r.name))
        },
        [state.repos, store.actions, setChartVisibility]
    )

    const handleDeleteRepoBtnClick = (repo: string) => {
        setState((prev) => ({
            ...prev,
            repos: prev.repos.filter((r) => r.name !== repo)
        }))
        store.actions.delRepo(repo)

        if (state.repos.length === 1) {
            setChartVisibility(false)
        }
    }

    const handleClearAllRepoBtnClick = () => {
        setState((prev) => ({
            ...prev,
            repos: []
        }))
        store.actions.setRepos([])
        setChartVisibility(false)
    }

    const handleInputerPasted = async (event: React.ClipboardEvent<HTMLInputElement>) => {
        if (!inputElRef.current) {
            return
        }
        const inputEl = inputElRef.current
        if (event.clipboardData) {
            event.preventDefault()
            const text = event.clipboardData.getData("text").replace(/(?:\r\n|\r|\n| )/g, "")
            const value = state.repo
            const prevStr = value.slice(0, Math.min(inputEl.selectionStart || 0, inputEl.selectionEnd || 0))
            const nextStr = value.slice(Math.max(inputEl.selectionStart || 0, inputEl.selectionEnd || 0))
            setState((prev) => ({ ...prev, repo: `${prevStr}${text}${nextStr}` }))
        }
    }

    const handleInputerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault()
            handleAddRepoBtnClick()
        }
    }

    return (
        <div className="w-full px-3 shrink-0 flex flex-col justify-start items-center">
            {/*
             * Ever fork: removed upstream's "Star History Monthly …" promo, which linked
             * to their blog, and the Subscribe link, which pointed at Bytebase's
             * newsletter. Both are their editorial/marketing, not ours.
             */}
            <div className="w-auto sm:w-full grow max-w-3xl 2xl:max-w-4xl mt-4 flex flex-row justify-center items-center rounded-full border border-hairline bg-black/[0.04] p-1 dark:border-hairline-dark dark:bg-white/[0.06]">
                <input
                    ref={inputElRef}
                    value={state.repo}
                    onChange={(e) => setState((prev) => ({ ...prev, repo: e.target.value }))}
                    className="h-10 w-auto grow shrink bg-transparent px-5 text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
                    type="text"
                    placeholder={state.repos.length > 0 ? "…add another repository" : "owner/repo — e.g. ever-co/ever-gauzy"}
                    onPaste={handleInputerPasted}
                    onKeyDown={handleInputerKeyDown}
                />
                <button
                    className={`h-10 shrink-0 rounded-full px-5 text-sm font-medium whitespace-nowrap bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200 ${store.isFetching ? "cursor-wait" : ""}`}
                    onClick={handleAddRepoBtnClick}
                >
                    View star history
                </button>
            </div>
            <div className="w-full mt-4 flex flex-row justify-center items-center">
                <div className={`w-full max-w-2xl flex flex-row flex-wrap justify-center items-center ${state.repos.length > 0 ? "" : "invisible"}`}>
                    {state.repos.map((item) => (
                        <div key={item.name} className="leading-8 px-3 pr-2 mb-2 text-dark dark:text-gray-200 rounded flex flex-row justify-center items-center border border-hairline dark:border-hairline-dark mr-3 last:mr-0">
                            <span className="relative w-3 h-3 mr-1 flex flex-row justify-center items-center cursor-pointer hover:opacity-60" onClick={() => handleDeleteRepoBtnClick(item.name)}>
                                <span className="w-3 rotate-45 h-px bg-[black] absolute top-1/2"></span>
                                <span className="w-3 -rotate-45 h-px bg-black absolute top-1/2"></span>
                            </span>
                            <span
                                className={`mr-1 cursor-pointer hover:line-through select-none ${item.visible ? "" : "line-through text-gray-400"}`}
                                onClick={() => handleToggleRepoItemVisible(item.name)}
                            >
                                {item.name}
                            </span>
                            <a href={`https://github.com/${item.name}`} target="_blank" className="flex items-center text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                <SketchExternalLinkIcon />
                            </a>
                        </div>
                    ))}
                    <button className="leading-8 mb-2 text-black dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 px-3 rounded border border-transparent" onClick={handleClearAllRepoBtnClick}>
                        Clear all
                    </button>
                </div>
            </div>
        </div>
    )
}