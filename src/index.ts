import { Command, flags } from "@oclif/command";
import { promisify } from "util";
import {
  existsSync,
  mkdir,
  createWriteStream,
  createReadStream,
  rmdir,
  unlink,
  readdir,
  rename
} from "fs";
import nodeFetch from "node-fetch";
import * as path from "path";
import * as unzipper from "unzipper";
const HttpsProxyAgent = require("https-proxy-agent");
const Listr = require("listr");

const mkdirP = promisify(mkdir);
const rmdirP = promisify(rmdir);
const readdirP = promisify(readdir);
const unlinkP = promisify(unlink);
const renameP = promisify(rename);

const REPO_URL = "https://github.com/XHMM/typescript-react-starter";
const ZIP_URL = REPO_URL + "/archive/master.zip";
const FOLDER_NAME = "typescript-react-starter-master";

class Trs extends Command {
  static description =
    "this is a simple cli for fetching and using typescript-react-starter repository";
  static flags = {
    version: flags.version({ char: "v" }),
    help: flags.help({ char: "h" }),
    name: flags.string({
      char: "n",
      description: "directory name",
      default: "typescript-react-starter"
    })
  };

  async run() {
    const { flags } = this.parse(Trs);
    const proxy =
      process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.http_proxy ||
      process.env.https_proxy;
    const dirName = flags.name!;
    const dirExists = existsSync(dirName);
    if (dirExists) this.error(`directory '${dirName}' already exists.`);
    const destDir = path.resolve(dirName);
    const zipPath = path.join(destDir, ".temp.zip");
    const unzippedFolder = path.join(destDir, FOLDER_NAME);
    const tasks = new Listr([
      {
        title: `Downloading starter from ${REPO_URL}`,
        task: () =>
          new Promise(async (resolve, reject) => {
            {
              try {
                const response = await nodeFetch(ZIP_URL, {
                  ...(proxy && { agent: new HttpsProxyAgent(proxy) }),
                  timeout: 10_000
                });
                const writableZip = createWriteStream(zipPath);
                response.body.pipe(writableZip);
                response.body.on("error", err => {
                  reject(err);
                });
                response.body.on("finish", async () => {
                  resolve();
                });
              } catch (e) {
                await rmdirP(destDir);
                reject(e);
              }
            }
          })
      },
      {
        title: "Extracting",
        task: () =>
          new Promise(async (resolve, reject) => {
            try {
              const unzip = unzipper.Extract({ path: destDir });
              const readableZip = createReadStream(zipPath);
              readableZip.pipe(unzip);
              unzip.on("close", async () => {
                resolve();
              });
            } catch (e) {
              reject(e);
            }
          })
      },
      {
        title: "Moving",
        task: () =>
          new Promise(async (resolve, reject) => {
            try {
              const files = await readdirP(unzippedFolder);
              await Promise.all(
                files.map(async file => {
                  const oP = path.join(unzippedFolder, file);
                  const nP = path.join(destDir, file);
                  await renameP(oP, nP);
                })
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          })
      },
      {
        title: "Deleting",
        task: () =>
          new Promise(async (resolve, reject) => {
            try {
              await unlinkP(zipPath);
              await rmdirP(unzippedFolder);
              resolve();
            } catch (e) {
              reject(e);
            }
          })
      }
    ]);
    await mkdirP(dirName);
    await tasks.run();
    this.log(`\n  Now you should run: `);
    this.log(`    - cd ${dirName}`);
    this.log(`    - npm install`);
    this.log(`    - npm run dev`);
  }
}

export = Trs;
