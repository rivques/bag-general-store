// adapted from the Old Man's scheduler, github:kcoderhtml/the-old-man

import { readFile, writeFile } from "fs/promises";
import {WebClient} from "@slack/web-api";
import { PriceConglomerate } from "./types";
import sendUpdate from "./sendUpdate";
import { rerollPrices, rerollItems } from "./calculatePrices";

export class Job {
    private timer: NodeJS.Timeout | null = null;
    public date: Date | null = null;
    private readonly duration: number;
    public state: "running" | "stopped" | "waiting" | "paused" = "stopped";
    public updateType: 'price' | 'item-reroll' = 'price';
    public runningPromise: Promise<void> | null = null;

    constructor(callback: () => void, date: Date, updateType: 'price' | 'item-reroll') {
        this.updateType = updateType
        this.duration = date.getTime() - Date.now();
        this.date = date;
        this.start(callback);
    }

    start(callback: () => void): void {
        if (this.timer === null) {
            this.state = "waiting";
            this.timer = setTimeout(async () => {
                this.runningPromise = new Promise(async (resolve) => {
                    this.state = "running";
                    await callback();
                    this.timer = null;
                    this.state = "stopped";
                    resolve();
                });
            }, this.duration);
        } else {
            throw new Error("Job is already running");
        }
    }

    async stop(): Promise<void> {
        if (this.timer !== null) {
            console.log("Stopping job");
            // if the job is waiting to run, clear the timeout
            if (this.state === "waiting") {
                console.log("Job is waiting");
                clearTimeout(this.timer);
                this.timer = null;
            } else if (this.state === "running") {
                // if the job is running, wait for it to finish
                console.log("Job is running");
                await this.runningPromise;
            }
        } else {
            throw new Error("Job is not running");
        }
    }

    async pause(): Promise<void> {
        if (this.timer !== null) {
            // if the job is waiting to run, clear the timeout
            if (this.state === "waiting") {
                clearTimeout(this.timer);
                this.timer = null;
                this.state = "paused";
            } else if (this.state === "running") {
                // if the job is running, wait for it to finish
                throw new Error("Job is running");
            }
        } else {
            throw new Error("Job is not running");
        }
    }
}

type JobData = {
    date: Date;
    updateType: 'price' | 'item-reroll'
};

export class Scheduler {
    public jobs: Job[] = [];
    private client: WebClient;
    public prices: PriceConglomerate | undefined;

    constructor(client: WebClient) {
        this.client = client
    }

    addJob(callback: () => void, date: Date, updateType: 'price' | 'item-reroll'): void {
        const job = new Job(callback, date, updateType);
        this.jobs.push(job);
    }

    listJobs(): Job[] {
        return this.jobs;
    }

    async stopAllJobs(): Promise<void> {
        console.log("Stopping all jobs");
        const stopPromises: Promise<void>[] = [];
        let alreadyStopped: number = 0;

        for (const job of this.jobs) {
            if (job.state !== "stopped") {
                const stopPromise = job.pause();
                stopPromises.push(stopPromise);
            } else {
                // remove the job from the list if it's already stopped
                this.jobs.splice(alreadyStopped, 1);
                alreadyStopped++;
            }
        }

        await Promise.all(stopPromises);
    }

    async savePricesToFile(filepath: string): Promise<void> {
        console.log("Saving prices to file");
        await writeFile(filepath, JSON.stringify(this.prices, null, 4));
    }

    async loadPricesFromFile(filepath: string): Promise<void> {
        try {
            // load prices from a file
            const data: PriceConglomerate = await readFile(filepath, "utf8").then((data) => JSON.parse(data));
            this.prices = data;
        } catch (error) {
            if (typeof Error) {
                console.error("No prices file found");
            } else {
                console.error(error);
            }
            this.prices = await rerollItems();
        }
    }

    // save all jobs to a file
    async saveJobsToFile(filepath: string): Promise<void> {
        console.log("Saving jobs to file");

        // save jobs to a file as an array of objects
        const jobsData: JobData[] = this.jobs.filter((job) => job.date && job.updateType && job.state !== "stopped").map((job) => {
            return {
                date: job.date!,
                updateType: job.updateType
            };
        });

        await writeFile(filepath, JSON.stringify(jobsData, null, 4));
    }

    // load jobs from a file
    async loadJobsFromFile(filepath: string): Promise<void> {
        if (!this.prices) {
            throw new Error("Prices must be loaded before jobs");
        }
        try {
            // load jobs from a file
            const data: JobData[] = await readFile(filepath, "utf8").then((data) => JSON.parse(data));

            this.jobs = data.map((jobData) => {
                // date is the latest of the job time and one second from now
                let date = new Date(jobData.date);
                if (date.getTime() < Date.now()) {
                    console.log(`Job date is in the past, setting to 30 seconds from now`)
                    date = new Date(Date.now() + 30000);
                    console.log(date);
                }

                const job = new Job(async () => {
                    if(jobData.updateType === 'price' && this.prices) {
                        this.prices = await rerollPrices(this.prices);
                    } else {
                        this.prices = await rerollItems();
                    }
                    sendUpdate(this.client, this.prices!, this);
                }, date, jobData.updateType);
                return job;
            });
        } catch (error) {
            if (typeof Error) {
                console.error("No jobs file found, creating...");
                //this.schedulePriceUpdate();
                this.scheduleItemReroll();
                this.saveJobsToFile(filepath);
            } else {
                console.error(error);
            }
        }
    }

    private schedulePriceUpdate(seconds: number = 20) {
        console.log(`NEW PRICE SCHEDULE: Scheduling price update in ${seconds} seconds...`)
        this.addJob(async () => {
            if(!this.prices) {
                console.warn("WARINING: tried to update prices when no prices existed. Rerolling items instead.")
                this.prices = await rerollItems();
            } else {
                this.prices = await rerollPrices(this.prices);
            }
            sendUpdate(this.client, this.prices!, this);
            //console.log(`A scheduled price update just ran! Scheduling the next...`)
            //this.schedulePriceUpdate();
        }, new Date(Date.now() + seconds*1000), 'price');
    }

    public scheduleItemReroll() {
        const date = new Date();
        date.setHours(23, 0, 0, 0);
        while (date.getTime() < Date.now()) {
            date.setDate(date.getDate() + 1);
        }
        this.addJob(async () => {
            this.prices = await rerollItems();
            sendUpdate(this.client, this.prices!, this);
            this.scheduleItemReroll();
        }, date, 'item-reroll');
    }

    async saveAll(jobsFilepath: string, pricesFilepath: string): Promise<void> {
        await this.saveJobsToFile(jobsFilepath);
        await this.savePricesToFile(pricesFilepath);
    }

    async loadAll(jobsFilepath: string, pricesFilepath: string): Promise<void> {
        await this.loadPricesFromFile(pricesFilepath);
        await this.loadJobsFromFile(jobsFilepath);
    }
}