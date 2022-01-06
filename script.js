"use strict";

// キャンバス情報取得
const CANVAS = document.getElementById("tet_field");
const CONTEXT = CANVAS.getContext("2d");

const MINO_SIZE = 20;

const FIELD_LINE = [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8];

// テトリミノデータ
const MINOS = [
  [0, 0, 0, 0, 0, 0, 0, 0], // null
  [0, 1, 1, 0, 1, 1, 1, 2], // T
  [0, 1, 0, 2, 1, 0, 1, 1], // S
  [0, 0, 0, 1, 1, 1, 1, 2], // Z
  [0, 2, 1, 0, 1, 1, 1, 2], // L
  [0, 0, 1, 0, 1, 1, 1, 2], // J
  [0, 1, 0, 2, 1, 1, 1, 2], // O
  [1, 0, 1, 1, 1, 2, 1, 3], // I
];

const FIELD_ROW = 23;
const FIELD_COL = 12;
const DEFAULT_SPEED = 1000;

const CANVAS_W = MINO_SIZE * FIELD_COL * 2;
const CANVAS_H = MINO_SIZE * (FIELD_ROW - 2) + MINO_SIZE / 2;
const MARGIN = (MINO_SIZE * FIELD_COL) / 2;

const DEFAULT_KEYS = {
  move_L: "ArrowLeft",
  move_R: "ArrowRight",
  softDrop: "ArrowDown",
  hardDrop: "ArrowUp",
  rotate_L: "a",
  rotate_R: "d",
  hold: "Shift",
};

const DEFAULT_STATS = {
  score: "-",
  level: 1,
  lines: "-",
};

let startTime;
let frameCount = 0;

let field = [];
let gameMode = "TITLE";
let selectPos = 0;
let confirmPos = 1;
let configPromptMode = false;

let mino_x = 0;
let mino_y = 0;
let currentMino;
let minoLength;
let minoNum;
let minoBag = [];
let direction;
let hold = 0;
let useHold = false;
let oldKeys = {};
let oldKey = "";

let keys = Object.assign({}, DEFAULT_KEYS);
let stats = Object.assign({}, DEFAULT_STATS);
let gameSpeed = DEFAULT_SPEED;

const BC_LIST = [
  "#777", //ghost
  "#6b2ee6", //T
  "#3dcc3d", //S
  "#e61717", //Z
  "#e65c17", //L
  "#3333ff", //J
  "#e6e645", //O
  "#4de7ff", //I
  "#999", //wall
];

// キャンバス描画サイズ指定
CANVAS.setAttribute("width", CANVAS_W);
CANVAS.setAttribute("height", CANVAS_H);

// フィールドマップ生成
function buildFieldMap() {
  let newField = field;
  while (newField.length < FIELD_ROW - 1) {
    newField.unshift(FIELD_LINE.slice());
  }
  newField.push([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);
  return newField;
}

// ミノデータから二次元配列を作成
function buildMinoMap(num, rotate) {
  let count = 0;
  let minoMap = [];
  let minoData = MINOS[num];
  let len;
  if (num === 7 && rotate === true) {
    while (minoMap.length < 4) {
      let defaultRow = [0, 0, 0, 0];
      minoMap.unshift(defaultRow.slice());
    }
    return minoMap;
  } else if (rotate === true) {
    num = 0;
  }
  if (num != 7) {
    len = 3;
  } else {
    len = 4;
  }
  for (let i = 0; i < len; i++) {
    minoMap.push([]);
    for (let j = 0; j < len; j++) {
      if (minoData[count] === i && minoData[count + 1] === j) {
        minoMap[i].push(num);
        count += 2;
      } else {
        minoMap[i].push(0);
      }
    }
  }
  return minoMap;
}

// ブロックを描画
function drawBlock(x, y, blockNum) {
  let blockColor = BC_LIST[blockNum];
  CONTEXT.beginPath();
  CONTEXT.fillStyle = blockColor;
  CONTEXT.rect(x + MARGIN, y - MINO_SIZE * 1.5, MINO_SIZE, MINO_SIZE);
  CONTEXT.fill();
  CONTEXT.strokeStyle = "#222";
  CONTEXT.lineWidth = "1";
  CONTEXT.stroke();
}

// テトリミノを描画
function drawMino() {
  let length = calcMinoLength(minoNum);
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (currentMino[i][j]) {
        drawBlock(
          (mino_x + j) * MINO_SIZE,
          (mino_y + i) * MINO_SIZE,
          currentMino[i][j]
        );
      }
    }
  }
}

// フィールドを描画
function drawField() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  for (let i = 1; i < FIELD_ROW; i++) {
    for (let j = 0; j < FIELD_COL; j++) {
      if (field[i][j]) {
        drawBlock(j * MINO_SIZE, i * MINO_SIZE, field[i][j]);
      }
    }
  }
}

function drawGhost() {
  let ghost_y = 0;
  for (let i = 1; checkMove(0, i); i++) {
    ghost_y = i;
  }
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        drawBlock(
          (mino_x + j) * MINO_SIZE,
          (ghost_y + mino_y + i) * MINO_SIZE,
          0
        );
      }
    }
  }
}

function drawLine() {
  CONTEXT.beginPath();
  CONTEXT.moveTo(MARGIN, MINO_SIZE / 2);
  CONTEXT.lineTo(FIELD_COL * MINO_SIZE + MARGIN, MINO_SIZE / 2);
  CONTEXT.strokeStyle = "#888";
  CONTEXT.lineWidth = 0.5;
  CONTEXT.stroke();
}

function drawFillText(t, x, y, size, color, weight) {
  CONTEXT.font = `${weight} ${size}px "Press Start 2P"`;
  CONTEXT.fillStyle = color;
  let w = CONTEXT.measureText(t).width;
  x = CANVAS_W / 2 - w / 2 + x;
  y = CANVAS_H / 2 + y;
  CONTEXT.fillText(t, x, y);
}

function drawStrokeText(t, x, y, size, color, weight) {
  CONTEXT.font = `${weight} ${size}px "Press Start 2P"`;
  CONTEXT.lineWidth = 0.1;
  CONTEXT.strokeStyle = color;
  let w = CONTEXT.measureText(t).width;
  x = CANVAS_W / 2 - w / 2 + x;
  y = CANVAS_H / 2 + y;
  CONTEXT.strokeText(t, x, y);
}

function drawWindows() {
  let x = 10 + MARGIN * 3;
  let y = 10;
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeStyle = "#ddd";
  drawRadialRect(x, y, MINO_SIZE * 5, MINO_SIZE * 5, 10, "#ddd");
  drawRadialRect(10, y, MINO_SIZE * 5, MINO_SIZE * 5, 10, "#ddd");
  CONTEXT.font = 'bold 15px "Press Start 2P"';
  CONTEXT.fillStyle = "#ddd";
  CONTEXT.fillText("NEXT", x + 10, 35);
  CONTEXT.fillText("HOLD", 20, 35);
  for (let i = 0; i <= 4; i++) {
    drawRadialRect(
      x,
      MINO_SIZE * (5 + i * 3) + y * 2,
      MINO_SIZE * 4,
      MINO_SIZE * 2.4,
      10,
      "#ddd"
    );
  }
}

function drawRadialRect(x, y, w, h, r, color) {
  CONTEXT.beginPath();
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeStyle = color;
  CONTEXT.moveTo(x, y + r);
  CONTEXT.arc(x + r, y + h - r, r, Math.PI, Math.PI * 0.5, true);
  CONTEXT.arc(x + w - r, y + h - r, r, Math.PI * 0.5, 0, 1);
  CONTEXT.arc(x + w - r, y + r, r, 0, Math.PI * 1.5, 1);
  CONTEXT.arc(x + r, y + r, r, Math.PI * 1.5, Math.PI, 1);
  CONTEXT.closePath();
  CONTEXT.stroke();
}

function drawNextMino() {
  if (minoBag.length < 7) {
    minoBag = minoBag.concat(genBag());
  }
  let nextMino = buildMinoMap(minoBag[0]);
  let length = calcMinoLength(minoBag[0]);
  let x = 0;
  let y = 0;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (nextMino[i][j]) {
        if (minoBag[0] <= 5) {
          x = MINO_SIZE / 2;
        } else if (minoBag[0] === 7) {
          y = -1 * (MINO_SIZE / 2);
        }
        drawBlock(
          x + (13 + j) * MINO_SIZE,
          y + (4 + i) * MINO_SIZE,
          nextMino[i][j]
        );
      }
    }
  }
}

function drawProspect() {
  if (minoBag.length < 7) {
    minoBag = minoBag.concat(genBag());
  }
  for (let i = 0; i < 5; i++) {
    drawSmallMino(i);
  }
}

function drawHold() {
  if (hold != 0 && useHold === false) {
    drawHoldMino(hold);
  } else if (hold != 0) {
    drawHoldMino(0);
  }
}

function drawHoldMino(color) {
  let holdMino = buildMinoMap(hold);
  let length = calcMinoLength(hold);
  let x = 0;
  let y = 0;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (holdMino[i][j]) {
        if (hold <= 5) {
          x = MINO_SIZE / 2;
        } else if (hold === 7) {
          y = -1 * (MINO_SIZE / 2);
        }
        drawBlock(x + (-5 + j) * MINO_SIZE, y + (4 + i) * MINO_SIZE, color);
      }
    }
  }
}

function drawSmallBlock(x, y, blockNum) {
  let blockColor = BC_LIST[blockNum];
  let blockSize = MINO_SIZE * 0.8;
  CONTEXT.beginPath();
  CONTEXT.fillStyle = blockColor;
  CONTEXT.rect(x + MARGIN, y - MINO_SIZE * 1.5, blockSize, blockSize);
  CONTEXT.fill();
  CONTEXT.strokeStyle = "#222";
  CONTEXT.lineWidth = "1";
  CONTEXT.stroke();
}

function drawSmallMino(num) {
  let targetNum = minoBag[num + 1];
  let targetMino = buildMinoMap(targetNum);
  let length = calcMinoLength(targetNum);
  let x = 0;
  let y = num * MINO_SIZE * 3;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (targetMino[i][j]) {
        if (targetNum <= 5) {
          x = (MINO_SIZE / 2) * 0.8;
        } else if (targetNum === 7) {
          y = -1 * ((MINO_SIZE / 2) * 0.8) + num * MINO_SIZE * 3;
        }
        drawSmallBlock(
          x + 12 * MINO_SIZE + (j + 1.1) * MINO_SIZE * 0.8,
          y + MINO_SIZE * 7.5 + (i + 0.5) * MINO_SIZE * 0.8,
          targetMino[i][j]
        );
      }
    }
  }
}

function drawStatus() {
  drawRadialRect(10, 20 + MINO_SIZE * 5, MINO_SIZE * 5, 150, 10, "#ddd");
  CONTEXT.font = '10px "Press Start 2P"';
  CONTEXT.fillStyle = "#ddd";
  const X = 20;
  const Y = 40 + MINO_SIZE * 5;
  let ny;
  for (let p in stats) {
    switch (p) {
      case "level":
        ny = Y;
        break;
      case "lines":
        ny = Y + 50;
        break;
      case "score":
        ny = Y + 100;
        break;
    }
    CONTEXT.textAlign = "end";
    CONTEXT.fillText(stats[p], MINO_SIZE * 5, ny + 20);
    CONTEXT.textAlign = "start";
    CONTEXT.fillText(p, X, ny);
  }
}

function drawAll() {
  drawField();
  drawGhost();
  drawMino();
  drawLine();
  drawWindows();
  drawNextMino();
  drawProspect();
  drawHold();
  drawStatus();
}

function genBag() {
  let newBag = new Array(7);
  let serialNum = 1;
  for (let i = 0; i < newBag.length; i++) {
    newBag[i] = serialNum;
    serialNum++;
  }
  for (let i = newBag.length; i > 1; i--) {
    let target = Math.floor(Math.random() * i);
    [newBag[target], newBag[i - 1]] = [newBag[i - 1], newBag[target]];
  }
  return newBag;
}

function calcMinoLength(num) {
  let lenth;
  switch (num) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      length = 3;
      break;
    case 7:
      length = 4;
      break;
  }
  return length;
}

function spawnMino() {
  if (minoBag.length === 0) {
    minoBag = genBag();
  }
  minoNum = minoBag.shift();
  currentMino = buildMinoMap(minoNum);
  minoLength = calcMinoLength(minoNum);
  mino_x = 4;
  mino_y = 0;
  direction = 444444444;
}

// 衝突判定
function checkMove(x, y, newMino) {
  if (newMino === undefined) {
    newMino = currentMino;
  }
  let new_x;
  let new_y;
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (newMino[i][j]) {
        new_x = mino_x + x + j;
        new_y = mino_y + y + i;
        if (
          new_x < 0 ||
          new_x >= FIELD_COL ||
          new_y >= FIELD_ROW ||
          field[new_y][new_x]
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

// 回転処理
function rotateMino(key) {
  let newMinoMap = buildMinoMap(minoNum, true);
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (key === "a") {
        if (currentMino[j][minoLength - 1 - i]) {
          newMinoMap[i][j] = currentMino[j][minoLength - 1 - i];
        }
      } else {
        if (currentMino[minoLength - 1 - j][i]) {
          newMinoMap[i][j] = currentMino[minoLength - 1 - j][i];
        }
      }
    }
  }
  return newMinoMap;
}

function srs(key, newMino) {
  let srsPosition = [];
  if (key === "a") {
    if (minoNum === 7) {
      switch (direction % 4) {
        case 0:
          srsPosition = [-1, 0, 2, 0, -1, -2, 2, 1];
          break;
        case 1:
          srsPosition = [2, 0, -1, 0, 2, -1, -1, 2];
          break;
        case 2:
          srsPosition = [1, 0, -2, 0, 1, 2, -2, -1];
          break;
        case 3:
          srsPosition = [1, 0, -2, 0, -2, 1, 1, -2];
          break;
      }
    } else {
      switch (direction % 4) {
        case 0:
          srsPosition = [1, 0, 1, -1, 0, 2, 1, 2];
          break;
        case 1:
          srsPosition = [1, 0, 1, 1, 0, -2, 1, -2];
          break;
        case 2:
          srsPosition = [-1, 0, -1, -1, 0, 2, -1, 2];
          break;
        case 3:
          srsPosition = [-1, 0, -1, 1, 0, -2, -1, -2];
          break;
      }
    }
  } else {
    if (minoNum === 7) {
      switch (direction % 4) {
        case 0:
          srsPosition = [-2, 0, 1, 0, -2, 1, 1, -2];
          break;
        case 1:
          srsPosition = [-1, 0, 2, 0, -1, -2, 2, 1];
          break;
        case 2:
          srsPosition = [2, 0, -1, 0, 2, -1, -1, 2];
          break;
        case 3:
          srsPosition = [-2, 0, 1, 0, 1, 2, -2, -1];
          break;
      }
    } else {
      switch (direction % 4) {
        case 0:
          srsPosition = [-1, 0, -1, -1, 0, 2, -1, 2];
          break;
        case 1:
          srsPosition = [1, 0, 1, 1, 0, -2, 1, -2];
          break;
        case 2:
          srsPosition = [1, 0, 1, -1, 0, 2, 1, 2];
          break;
        case 3:
          srsPosition = [-1, 0, -1, 1, 0, -2, -1, -2];
          break;
      }
    }
  }
  for (let i = 0; i <= 6; i += 2) {
    if (checkMove(srsPosition[i], srsPosition[i + 1], newMino)) {
      currentMino = newMino;
      mino_x += srsPosition[i];
      mino_y += srsPosition[i + 1];
      break;
    }
  }
}

function fixMino() {
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        field[mino_y + i][mino_x + j] = minoNum;
      }
    }
  }
  useHold = false;
  spawnMino();
}

function dropMino() {
  if (checkMove(0, 1)) {
    mino_y++;
  } else {
    checkLineOver();
    fixMino();
    checkCollision();
  }
}

function hardDrop() {
  let ghost_y = 0;
  for (let i = 1; checkMove(0, i); i++) {
    ghost_y = i;
  }
  mino_y += ghost_y;
  checkLineOver();
  fixMino();
  checkCollision();
}

function swapHold() {
  if (useHold === false) {
    if (hold === 0) {
      hold = minoNum;
      spawnMino();
    } else {
      [hold, minoNum] = [minoNum, hold];
      currentMino = buildMinoMap(minoNum);
      minoLength = calcMinoLength(minoNum);
      mino_x = 4;
      mino_y = 0;
      direction = 444444444;
    }
    useHold = true;
  }
}

function checkLine() {
  let alignLine = [];
  for (let i = 1; i < FIELD_ROW - 1; i++) {
    for (let j = 1; j < FIELD_COL - 1; j++) {
      if (field[i][j]) {
        if (j === field[i].length - 2) {
          alignLine.push(i);
        }
      } else {
        break;
      }
    }
  }
  if (alignLine.length === 0) {
    return;
  } else {
    return alignLine;
  }
}

function clearLine(alignLine) {
  for (let line of alignLine) {
    field.splice(line, 1);
    field.unshift(FIELD_LINE.slice());
    stats.lines++;
  }
}

function checkLineOver() {
  let lineOverCount = 0;
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        if (mino_y + i <= 1) {
          lineOverCount++;
          if (lineOverCount === 4) {
            gameMode = "GAME_OVER";
            return;
          }
        }
      }
    }
  }
}

function checkCollision() {
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        if (field[mino_y + i][mino_x + j]) {
          gameMode = "GAME_OVER";
          return;
        }
      }
    }
  }
}

function initialize(mode) {
  gameMode = mode;
  selectPos = 0;
  configPromptMode = false;
  startTime = performance.now();
  field = [];
  field = buildFieldMap();
  minoBag = [];
  frameCount = 0;
  mino_x = 0;
  mino_y = 0;
  hold = 0;
  useHold = false;
  gameSpeed = DEFAULT_SPEED;
  stats = Object.assign({}, DEFAULT_STATS);
}

function drawTitle() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStrokeText("TETLiS", 0, -60, 70, "#ddd", "bold");
  drawFillText("NORMAL GAME", 0, 0, 20, "#ddd", "bold");
  drawFillText("CONFiG", 0, 30, 20, "#ddd", "bold");
  drawFillText("Press ENTER to start!", 0, 100, 20, "#ddd", "bold");
  drawFillText("->", -140, selectPos * 30, 20, "#ddd", "bold");
}

function drawGameOver() {
  let length = calcMinoLength(minoNum);
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (currentMino[i][j]) {
        drawBlock((mino_x + j) * MINO_SIZE, (mino_y + i) * MINO_SIZE, 0);
      }
    }
  }
  for (let i = 1; i < FIELD_ROW - 1; i++) {
    for (let j = 1; j < FIELD_COL - 1; j++) {
      if (field[i][j]) {
        drawBlock(j * MINO_SIZE, i * MINO_SIZE, 0);
      }
    }
  }
  drawFillText("GAME", 0, -20, "80", "#222", "bold");
  drawStrokeText("GAME", 0, -20, "80", "#ddd", "bold");
  drawFillText("OVER", 0, 70, "80", "#222", "bold");
  drawStrokeText("OVER", 0, 70, "80", "#ddd", "bold");
  drawFillText("Press SPACE", 0, 140, "30", "#222", "normal");
  drawStrokeText("Press SPACE", 0, 140, "30", "#ddd", "bold");
}

function drawConfig() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFillText("KEY CONFiG", 0, -150, 40, "#ddd", "bold");
  const Y = CANVAS_H / 2 - 100;
  let ny;
  let t;
  let arrow_y;
  let key;
  for (let p in keys) {
    let key = keys[p];
    switch (key) {
      case "ArrowUp":
        key = "↑";
        break;
      case "ArrowDown":
        key = "↓";
        break;
      case "ArrowLeft":
        key = "<-";
        break;
      case "ArrowRight":
        key = "->";
        break;
      case " ":
        key = "Space";
        break;
    }
    switch (p) {
      case "move_L":
        ny = Y;
        t = `Move Left    : ${key}`;
        break;
      case "move_R":
        ny = Y + 30;
        t = `Move Right   : ${key}`;
        break;
      case "softDrop":
        ny = Y + 60;
        t = `Soft Drop    : ${key}`;
        break;
      case "hardDrop":
        ny = Y + 90;
        t = `Hard Drop    : ${key}`;
        break;
      case "rotate_L":
        ny = Y + 120;
        t = `Rotate Left  : ${key}`;
        break;
      case "rotate_R":
        ny = Y + 150;
        t = `Rotate Right : ${key}`;
        break;
      case "hold":
        ny = Y + 180;
        t = `Hold         : ${key}`;
        break;
    }
    if (selectPos >= 7) {
      arrow_y = selectPos * 30 - 70;
    } else {
      arrow_y = selectPos * 30 - 100;
    }
    if (configPromptMode) {
      key = "_";
      switch (selectPos) {
        case 0:
          oldKey = oldKeys.move_L;
          keys.move_L = key;
          break;
        case 1:
          oldKey = oldKeys.move_R;
          keys.move_R = key;
          break;
        case 2:
          oldKey = oldKeys.softDrop;
          keys.softDrop = key;
          break;
        case 3:
          oldKey = oldKeys.hardDrop;
          keys.hardDrop = key;
          break;
        case 4:
          oldKey = oldKeys.rotate_L;
          keys.rotate_L = key;
          break;
        case 5:
          oldKey = oldKeys.rotate_R;
          keys.rotate_R = key;
          break;
        case 6:
          oldKey = oldKeys.hold;
          keys.hold = key;
          break;
      }
    }
    CONTEXT.font = `normal 18px "Press Start 2P"`;
    CONTEXT.fillStyle = "#ddd";
    CONTEXT.fillText(t, 80, ny);
  }
  CONTEXT.fillText("Default", 80, Y + 270);
  CONTEXT.fillText("Back to Title", 80, Y + 240);
  drawFillText("->", -185, arrow_y, 20, "#ddd", "bold");
  drawFillText("SELECT: Enter / CANCEL: Esc", 0, 210, 14, "#ddd", "normal");
}

function changeKey(key) {
  if (key === "Enter") {
    drawConfig();
    drawFillText("CAN'T USE !", 0, 110, 20, "#ddd", "bold");
    return;
  } else if (Object.values(keys).includes(key)) {
    drawConfig();
    drawFillText("ALREADY USED !", 0, 110, 20, "#ddd", "bold");
    return;
  } else if (key === "Escape") {
    key = oldKey;
  }
  switch (selectPos) {
    case 0:
      keys.move_L = key;
      break;
    case 1:
      keys.move_R = key;
      break;
    case 2:
      keys.softDrop = key;
      break;
    case 3:
      keys.hardDrop = key;
      break;
    case 4:
      keys.rotate_L = key;
      break;
    case 5:
      keys.rotate_R = key;
      break;
    case 6:
      keys.hold = key;
      break;
  }
  configPromptMode = !configPromptMode;
  drawConfig();
}

function drawConfigConfirm() {
  let w = 300;
  let h = 100;
  CONTEXT.fillStyle = "#222";
  CONTEXT.lineWidth = 1;
  CONTEXT.rect(CANVAS_W / 2 - w / 2, CANVAS_H / 2 - h / 2, w, h);
  CONTEXT.fill();
  CONTEXT.stroke();
  drawFillText("Are you sure?", 0, -10, 20, "#ddd", "bold");
  drawFillText("yes   no", 0, 30, 20, "#ddd", "bold");
  if (confirmPos === 0) {
    drawFillText("[    ]", -50, 30, 20, "#ddd", "bold");
  } else {
    drawFillText("[    ]", 60, 30, 20, "#ddd", "bold");
  }
}

document.getElementById("download").onclick = (event) => {
  let canvas = document.getElementById("tet_field");

  let link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "tetris.png";
  link.click();
};

// キーボードイベント
document.onkeydown = function (e) {
  switch (gameMode) {
    case "NORMAL_GAME":
      switch (e.key) {
        case keys.move_L: // 左移動(←)
          if (checkMove(-1, 0)) {
            mino_x--;
          }
          break;
        case keys.move_R: // 右移動(→)
          if (checkMove(1, 0)) {
            mino_x++;
          }
          break;
        case keys.softDrop: // 下移動(↓)
          if (checkMove(0, 1)) {
            mino_y++;
          }
          break;
        case keys.hardDrop: // ハードドロップ(↑)
          hardDrop();
          break;
        case keys.rotate_L: // 左回転(a)
          if (minoNum != 6) {
            let newMino = rotateMino(e.key);
            if (checkMove(0, 0, newMino)) {
              currentMino = newMino;
            } else {
              srs(e.key, newMino);
            }
          }
          direction -= 1;
          break;
        case keys.rotate_R: // 右移動(d)
          if (minoNum != 6) {
            let newMino = rotateMino(e.key);
            if (checkMove(0, 0, newMino)) {
              currentMino = newMino;
            } else {
              srs(e.key, newMino);
            }
          }
          direction += 1;
          break;
        case keys.hold:
          swapHold();
          break;
      }
      drawAll();
      break;
    case "GAME_OVER":
      if (e.key === " ") {
        initialize("TITLE");
        drawTitle();
      }
      break;
    case "TITLE":
      switch (e.key) {
        case "ArrowUp":
          selectPos--;
          break;
        case "ArrowDown":
          selectPos++;
          break;
        case "Enter":
          if (selectPos === 0) {
            initialize("NORMAL_GAME");
            spawnMino();
            drawAll();
            mainLoop();
            return;
          } else if (selectPos === 1) {
            initialize("CONFIG");
            drawConfig();
            return;
          }
          break;
      }
      if (selectPos < 0) {
        selectPos += 2;
      }
      selectPos %= 2;
      drawTitle();
      break;
    case "CONFIG":
      if (!configPromptMode) {
        switch (e.key) {
          case "ArrowUp":
            selectPos--;
            break;
          case "ArrowDown":
            selectPos++;
            break;
          case "Enter":
            if (selectPos === 7) {
              gameMode = "CONFIG_CONFIRM";
              drawConfigConfirm();
              return;
            } else if (selectPos === 8) {
              gameMode = "CONFIG_CONFIRM";
              drawConfigConfirm();
              return;
            } else {
              oldKeys = JSON.parse(JSON.stringify(keys));
              configPromptMode = !configPromptMode;
              drawConfig();
            }
            break;
        }
        if (selectPos < 0) {
          selectPos += 9;
        }
        selectPos %= 9;
        drawConfig();
        break;
      } else {
        changeKey(e.key);
      }
      break;
    case "CONFIG_CONFIRM":
      switch (e.key) {
        case "ArrowLeft":
          confirmPos--;
          break;
        case "ArrowRight":
          confirmPos++;
          break;
        case "Enter":
          if (confirmPos === 1) {
            gameMode = "CONFIG";
            drawConfig();
            confirmPos = 1;
            return;
          }
          switch (selectPos) {
            case 7:
              initialize("TITLE");
              drawTitle();
              confirmPos = 1;
              return;
            case 8:
              gameMode = "CONFIG";
              keys = Object.assign({}, DEFAULT_KEYS);
              drawConfig();
              confirmPos = 1;
              return;
          }
          break;
      }
      if (confirmPos < 0) {
        confirmPos += 2;
      }
      confirmPos %= 2;
      drawConfigConfirm();
      break;
  }
};

function mainLoop() {
  let nowTime = performance.now();
  let nowFrame = (nowTime - startTime) / gameSpeed;
  switch (gameMode) {
    case "NORMAL_GAME":
      if (nowFrame > frameCount) {
        let c = 0;
        while (nowFrame > frameCount) {
          frameCount++;
          let alignLine = checkLine();
          if (alignLine != undefined) {
            clearLine(alignLine);
          } else {
            dropMino();
          }
          if (++c >= 4) {
            break;
          }
        }
      }
      drawAll();
      requestAnimationFrame(mainLoop);
      break;
    case "GAME_OVER":
      drawGameOver();
      cancelAnimationFrame(mainLoop);
      break;
  }
}

window.onload = function () {
  startTime = performance.now();
};

WebFont.load({
  custom: {
    families: ["Press Start 2P"],
  },
  active: function () {
    drawTitle();
    // gameMode = "CONFIG_CONFIRM";
    // drawConfigConfirm(); //test
  },
  inactive: function () {
    drawTitle();
  },
});
