'use strict';
/* eslint-disable linebreak-style */

const chalk = require('chalk');
var isHexcolor = require('is-hexcolor');

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function interpolateColor(color1, color2, factor) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return '#000000';

    const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
    const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
    const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));
    
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

// Bộ màu gradient cũ
// const gradientColors = [
//     '#FF0000', 
//     '#FF00FF', 
//     '#0000FF', 
//     '#00FFFF', 
//     '#00FF00'  
// ];

// Tất cả các bộ màu gradient từ log.js
const allGradientSets = [
    // Rainbow
    [
        '#FF0000', // Đỏ
        '#FF7F00', // Cam
        '#FFFF00', // Vàng
        '#00FF00', // Xanh lá
        '#0000FF', // Xanh dương
        '#4B0082', // Chàm
        '#9400D3'  // Tím
    ],
    // Xanh dương nhạt đến xanh lam
    [
        '#0099F7', 
        '#4BA3E3', 
        '#71B7E0', 
        '#8FD3F4', 
        '#B3E0F2'
    ],
    // Xanh lá cây đến xanh dương
    [
        '#11998e',
        '#38ef7d',
        '#00c6ff',
        '#0072ff'
    ],
    // Cam đến hồng nhạt
    [
        '#FF8C00',
        '#FF7F50',
        '#FF6347',
        '#FF69B4'
    ],
    // Xanh tím nhạt đến hồng
    [
        '#a18cd1',
        '#bad0f1',
        '#fbc2eb'
    ],
    // Xanh lá đến xanh dương nhạt
    [
        '#84fab0',
        '#8fd3f4',
        '#66a6ff'
    ],
    // Hoàng hôn
    [
        '#f37335',
        '#fdc830',
        '#f5af19'
    ],
    // Đại dương
    [
        '#1cb5e0',
        '#2980b9',
        '#000046'
    ],
    // Rừng
    [
        '#134e5e',
        '#71b280',
        '#2c3e50'
    ],
    // Kẹo
    [
        '#ee9ca7',
        '#ffdde1',
        '#ff9a9e'
    ],
    // Điện
    [
        '#00c3ff',
        '#77A1D3',
        '#667eea'
    ]
];

// Chọn một bộ màu ngẫu nhiên cho mỗi lần khởi động
let currentSetIndex = Math.floor(Math.random() * allGradientSets.length);
let gradientColors = allGradientSets[currentSetIndex];

// Hàm để thay đổi bộ màu
function setRandomGradient() {
    currentSetIndex = (currentSetIndex + 1) % allGradientSets.length;
    gradientColors = allGradientSets[currentSetIndex];
    return currentSetIndex;
}

// Gọi hàm này mỗi 100 lần log để thay đổi màu
let logCount = 0;
const LOG_THRESHOLD = 100;

function createGradientText(text, startColor, endColor) {
    const chars = text.split('');
    const gradient = chars.map((char, i) => {
        const factor = i / (chars.length - 1 || 1);
        const color = interpolateColor(startColor, endColor, factor);
        return chalk.hex(color)(char);
    });
    return gradient.join('');
}

function createMultiGradientText(text) {
    // Kiểm tra và đổi màu mỗi 100 lần log
    logCount++;
    if (logCount >= LOG_THRESHOLD) {
        setRandomGradient();
        logCount = 0;
    }

    const chars = text.split('');
    const totalColors = gradientColors.length;
    const charsPerSection = Math.ceil(chars.length / (totalColors - 1));
    
    return chars.map((char, i) => {
        const section = Math.floor(i / charsPerSection);
        const colorIndex = Math.min(section, totalColors - 2);
        const factor = (i % charsPerSection) / charsPerSection;
        const color = interpolateColor(
            gradientColors[colorIndex],
            gradientColors[colorIndex + 1],
            factor
        );
        return chalk.hex(color)(char);
    }).join('');
}

var getText = function(/** @type {string[]} */ ...Data) {
    var Main = (Data.splice(0,1)).toString();
    for (let i = 0; i < Data.length; i++) Main = Main.replace(RegExp(`%${i + 1}`, 'g'), Data[i]);
    return Main;
};

/**
 * @param {any} obj
 */
function getType(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}

// Tên và phiên bản của logger
const LoggerName = "FCA-Enhanced";
const LoggerVersion = "1.0.0";

module.exports = {
    Normal: function(/** @type {string} */ Str, /** @type {() => any} */ Data, /** @type {() => void} */ Callback) {
        if (isHexcolor(global.Fca.Require.FastConfig.MainColor) != true) {
            this.Warning(getText(global.Fca.Require.Language.Index.InvaildMainColor, global.Fca.Require.FastConfig.MainColor), process.exit(0));
        }
        else {
            const prefix = chalk.hex(global.Fca.Require.FastConfig.MainColor).bold(`${global.Fca.Require.FastConfig.MainName || '[ FCA-HZI ]'} > `);
            const gradientMessage = createMultiGradientText(Str);
            console.log(prefix + gradientMessage);
        }
        if (getType(Data) == 'Function' || getType(Data) == 'AsyncFunction') {
            return Data();
        }
        if (Data) {
            return Data;
        }
        if (getType(Callback) == 'Function' || getType(Callback) == 'AsyncFunction') {
            Callback();
        }
        else return Callback;
    },
    Warning: function(/** @type {unknown} */ str, /** @type {() => void} */ callback) {
        const gradientMessage = createGradientText(String(str), '#FFD700', '#FFA500'); // Gradient từ vàng sang cam
        console.log(chalk.magenta.bold('[ FCA-WARNING ] > ') + gradientMessage);
        if (getType(callback) == 'Function' || getType(callback) == 'AsyncFunction') {
            callback();
        }
        else return callback;
    },
    Error: function(/** @type {unknown} */ str, /** @type {() => void} */ callback) {
        if (!str) {
            console.log(chalk.magenta.bold('[ FCA-ERROR ] > ') + createGradientText("Already Faulty, Please Contact: Facebook.com/Lazic.Kanzu", '#FF0000', '#8B0000'));
        }
        const gradientMessage = createGradientText(String(str), '#FF0000', '#8B0000'); // Gradient từ đỏ sáng sang đỏ đậm
        console.log(chalk.magenta.bold('[ FCA-ERROR ] > ') + gradientMessage);
        if (getType(callback) == 'Function' || getType(callback) == 'AsyncFunction') {
            callback();
        }
        else return callback;
    },
    Success: function(/** @type {unknown} */ str, /** @type {() => void} */ callback) {
        const gradientMessage = createGradientText(String(str), '#00FF00', '#006400'); // Gradient từ xanh lá sáng sang xanh lá đậm
        console.log(chalk.hex('#9900FF').bold(`${global.Fca.Require.FastConfig.MainName || '[ FCA-HZI ]'} > `) + gradientMessage);
        if (getType(callback) == 'Function' || getType(callback) == 'AsyncFunction') {
            callback();
        }
        else return callback;
    },
    Info: function(/** @type {unknown} */ str, /** @type {() => void} */ callback) {
        const gradientMessage = createGradientText(String(str), '#00BFFF', '#0000FF'); // Gradient từ xanh dương nhạt sang xanh dương đậm
        console.log(chalk.hex('#9900FF').bold(`${global.Fca.Require.FastConfig.MainName || '[ FCA-HZI ]'} > `) + gradientMessage);
        if (getType(callback) == 'Function' || getType(callback) == 'AsyncFunction') {
            callback();
        }
        else return callback;
    },
    // Thêm một phương thức mới để hiển thị thông tin về logger
    LoggerInfo: function() {
        console.log("\n" + createMultiGradientText("╔══════════════════════════════════════════════════════════════╗"));
        console.log(createMultiGradientText("║                     Logger Information                       ║"));
        console.log(createMultiGradientText("╠══════════════════════════════════════════════════════════════╣"));
        console.log(createMultiGradientText(`║ Name: ${LoggerName.padEnd(55, " ")}║`));
        console.log(createMultiGradientText(`║ Version: ${LoggerVersion.padEnd(52, " ")}║`));
        console.log(createMultiGradientText(`║ Current Gradient Set: ${(currentSetIndex + 1).toString().padEnd(41, " ")}║`));
        console.log(createMultiGradientText(`║ Total Gradient Sets: ${allGradientSets.length.toString().padEnd(41, " ")}║`));
        console.log(createMultiGradientText("╚══════════════════════════════════════════════════════════════╝\n"));
        
        // Hiển thị mẫu của tất cả các gradient
        console.log(createMultiGradientText("All Available Gradient Sets:"));
        const currentSet = gradientColors;
        for (let i = 0; i < allGradientSets.length; i++) {
            gradientColors = allGradientSets[i];
            console.log(createMultiGradientText(`Set ${i + 1}: This is a sample text to demonstrate the gradient colors.`));
        }
        
        // Khôi phục lại bộ màu hiện tại
        gradientColors = currentSet;
    }
};