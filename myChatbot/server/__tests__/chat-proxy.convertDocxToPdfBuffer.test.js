const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

jest.mock("child_process", () => ({
  spawn: jest.fn()
}));

const { spawn } = require("child_process");
const { convertDocxToPdfBuffer } = require("../chat-proxy");

const EXPECTED_COMMANDS = process.platform === "win32"
  ? ["soffice.exe", "libreoffice.exe"]
  : ["soffice", "libreoffice"];

function outdirFromArgs(args) {
  const idx = args.indexOf("--outdir");
  return args[idx + 1];
}

function makeFakeChild() {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe("convertDocxToPdfBuffer", () => {
  beforeEach(() => {
    spawn.mockReset();
  });

  test("invokes the platform LibreOffice binary with the expected headless conversion flags and paths", async () => {
    spawn.mockImplementation(function(cmd, args) {
      const child = makeFakeChild();
      const outdir = outdirFromArgs(args);
      process.nextTick(function() {
        fs.writeFileSync(path.join(outdir, "quote.pdf"), Buffer.from("%PDF-fake"));
        child.emit("close", 0);
      });
      return child;
    });

    await convertDocxToPdfBuffer(Buffer.from("docx-bytes"));

    expect(spawn).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = spawn.mock.calls[0];

    expect(cmd).toBe(EXPECTED_COMMANDS[0]);
    expect(args[0]).toBe("--headless");
    expect(args).toContain("--norestore");
    expect(args).toContain("--convert-to");
    expect(args[args.indexOf("--convert-to") + 1]).toBe("pdf");
    expect(args).toContain("--outdir");

    const outdir = outdirFromArgs(args);
    const docxPath = args[args.length - 1];
    expect(docxPath).toBe(path.join(outdir, "quote.docx"));

    const userInstallationArg = args.find(function(a) { return String(a).indexOf("-env:UserInstallation=") === 0; });
    expect(userInstallationArg).toBeDefined();
    expect(userInstallationArg).toMatch(/^-env:UserInstallation=file:\/\//);

    expect(opts).toHaveProperty("env");
    expect(opts.env).toHaveProperty("HOME");

    // the docx buffer is actually written to disk before conversion is invoked
    expect(fs.existsSync(docxPath)).toBe(false); // cleaned up by the function's finally block
  });

  test("writes the supplied buffer to quote.docx in the temp dir before converting", async () => {
    let capturedDocxPath;
    const inputBuffer = Buffer.from("hello-docx-content");

    spawn.mockImplementation(function(cmd, args) {
      capturedDocxPath = args[args.length - 1];
      // assert file contents at the moment LibreOffice would read them
      expect(fs.readFileSync(capturedDocxPath)).toEqual(inputBuffer);

      const child = makeFakeChild();
      const outdir = outdirFromArgs(args);
      process.nextTick(function() {
        fs.writeFileSync(path.join(outdir, "quote.pdf"), Buffer.from("%PDF-fake"));
        child.emit("close", 0);
      });
      return child;
    });

    await convertDocxToPdfBuffer(inputBuffer);
    expect(capturedDocxPath).toMatch(/quote\.docx$/);
  });

  test("returns the generated quote.pdf bytes on success", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4 fake pdf content");

    spawn.mockImplementation(function(cmd, args) {
      const child = makeFakeChild();
      const outdir = outdirFromArgs(args);
      process.nextTick(function() {
        fs.writeFileSync(path.join(outdir, "quote.pdf"), pdfBytes);
        child.emit("close", 0);
      });
      return child;
    });

    const result = await convertDocxToPdfBuffer(Buffer.from("docx-bytes"));

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(pdfBytes);
  });

  test("falls back to the second command when the first binary is not found, and still succeeds", async () => {
    let callIndex = 0;

    spawn.mockImplementation(function(cmd, args) {
      const child = makeFakeChild();
      const outdir = outdirFromArgs(args);
      const thisCall = callIndex;
      callIndex += 1;

      process.nextTick(function() {
        if (thisCall === 0) {
          const err = new Error("spawn soffice.exe ENOENT");
          err.code = "ENOENT";
          child.emit("error", err);
        } else {
          fs.writeFileSync(path.join(outdir, "quote.pdf"), Buffer.from("%PDF-second"));
          child.emit("close", 0);
        }
      });
      return child;
    });

    const result = await convertDocxToPdfBuffer(Buffer.from("docx-bytes"));

    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn.mock.calls[0][0]).toBe(EXPECTED_COMMANDS[0]);
    expect(spawn.mock.calls[1][0]).toBe(EXPECTED_COMMANDS[1]);
    expect(result).toEqual(Buffer.from("%PDF-second"));
  });

  test("throws an aggregated error when the conversion process exits with a non-zero code on every attempt", async () => {
    spawn.mockImplementation(function() {
      const child = makeFakeChild();
      process.nextTick(function() {
        child.stderr.emit("data", "soffice: command failed badly\n");
        child.emit("close", 1);
      });
      return child;
    });

    await expect(convertDocxToPdfBuffer(Buffer.from("docx-bytes")))
      .rejects.toThrow(/LibreOffice nem erheto el/);

    let caught;
    try {
      await convertDocxToPdfBuffer(Buffer.from("docx-bytes"));
    } catch (e) {
      caught = e;
    }
    expect(caught.message).toMatch(/soffice\.exe: .*command failed badly/);
    expect(caught.message).toMatch(new RegExp(EXPECTED_COMMANDS[1] + ":"));
  });

  test("propagates a spawn error (binary missing/unrunnable) for every attempted command", async () => {
    spawn.mockImplementation(function(cmd) {
      const child = makeFakeChild();
      process.nextTick(function() {
        const err = new Error("spawn " + cmd + " ENOENT");
        err.code = "ENOENT";
        child.emit("error", err);
      });
      return child;
    });

    await expect(convertDocxToPdfBuffer(Buffer.from("docx-bytes")))
      .rejects.toThrow(/LibreOffice nem erheto el/);
    await expect(convertDocxToPdfBuffer(Buffer.from("docx-bytes")))
      .rejects.toThrow(/nem talalhato vagy nem futtathato \(ENOENT\)/);
  });

  test("rejects when the process exits 0 but no quote.pdf file was actually produced", async () => {
    spawn.mockImplementation(function() {
      const child = makeFakeChild();
      process.nextTick(function() {
        // exit code 0 but the pdf file is never written
        child.emit("close", 0);
      });
      return child;
    });

    await expect(convertDocxToPdfBuffer(Buffer.from("docx-bytes")))
      .rejects.toThrow(/LibreOffice nem erheto el/);
  });

  test("cleans up the temp docx/profile directories even when every attempt fails", async () => {
    const createdTempDirs = [];
    const realMkdtempSync = fs.mkdtempSync;
    jest.spyOn(fs, "mkdtempSync").mockImplementation(function(prefix, options) {
      const dir = realMkdtempSync(prefix, options);
      createdTempDirs.push(dir);
      return dir;
    });

    spawn.mockImplementation(function() {
      const child = makeFakeChild();
      process.nextTick(function() {
        child.emit("close", 1);
      });
      return child;
    });

    await expect(convertDocxToPdfBuffer(Buffer.from("docx-bytes"))).rejects.toThrow();

    expect(createdTempDirs.length).toBeGreaterThan(0);
    createdTempDirs.forEach(function(dir) {
      expect(fs.existsSync(dir)).toBe(false);
    });

    fs.mkdtempSync.mockRestore();
  });

  describe("edge cases around the input buffer", () => {
    test("missing input (undefined buffer) throws synchronously before any spawn call", async () => {
      spawn.mockImplementation(function() {
        throw new Error("spawn should not be called when writeFileSync fails first");
      });

      await expect(convertDocxToPdfBuffer(undefined)).rejects.toThrow();
      expect(spawn).not.toHaveBeenCalled();
    });

    test("missing input (null buffer) throws synchronously before any spawn call", async () => {
      spawn.mockImplementation(function() {
        throw new Error("spawn should not be called when writeFileSync fails first");
      });

      await expect(convertDocxToPdfBuffer(null)).rejects.toThrow();
      expect(spawn).not.toHaveBeenCalled();
    });

    test("empty buffer is still written and forwarded to LibreOffice as quote.docx (no input-size validation in implementation)", async () => {
      spawn.mockImplementation(function(cmd, args) {
        const docxPath = args[args.length - 1];
        expect(fs.readFileSync(docxPath).length).toBe(0);

        const child = makeFakeChild();
        const outdir = outdirFromArgs(args);
        process.nextTick(function() {
          fs.writeFileSync(path.join(outdir, "quote.pdf"), Buffer.from("%PDF-empty-ok"));
          child.emit("close", 0);
        });
        return child;
      });

      const result = await convertDocxToPdfBuffer(Buffer.alloc(0));
      expect(result).toEqual(Buffer.from("%PDF-empty-ok"));
    });

    test("the function ignores any notion of an original file extension: input is always staged as quote.docx and output is always quote.pdf, regardless of what the caller passes", async () => {
      // The implementation takes a raw Buffer, not a file path, so there is no
      // extension to validate. This test documents that behavior explicitly.
      spawn.mockImplementation(function(cmd, args) {
        const docxPath = args[args.length - 1];
        expect(path.basename(docxPath)).toBe("quote.docx");

        const child = makeFakeChild();
        const outdir = outdirFromArgs(args);
        process.nextTick(function() {
          fs.writeFileSync(path.join(outdir, "quote.pdf"), Buffer.from("%PDF-ext"));
          child.emit("close", 0);
        });
        return child;
      });

      // even buffer content that looks like a different file type (e.g. a PNG header)
      // is staged as quote.docx unconditionally
      const pngLikeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const result = await convertDocxToPdfBuffer(pngLikeBuffer);
      expect(result).toEqual(Buffer.from("%PDF-ext"));
    });
  });
});
