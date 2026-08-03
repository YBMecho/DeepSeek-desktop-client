---
title: "使用浏览器内置的Web Speech API实现语音转文字"
url: https://zhuanlan.zhihu.com/p/721095122
author: w0fv1.dev​
date: 2026-08-03
---

## 写作背景

在知识付费直播中，常常会遇到听众在直播结束后忘记内容的情况。为了解决这一问题，通常的做法是提供讲义或文档，帮助听众沉淀和复习。然而，有时直播依赖临场发挥，无法提前准备详细的讲义。而在实践中发现，一边讲解一边手动整理输入编辑出文档也是不现实的。

为了找到一个实时生成文档的解决方案，我尝试了多种方案，但都不尽人意。AI[离线语音识别](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=%E7%A6%BB%E7%BA%BF%E8%AF%AD%E9%9F%B3%E8%AF%86%E5%88%AB&zhida_source=entity)虽然准确度高，但占用资源多，不适合长时间的实时直播。而在线的付费方案虽然便捷，但功能并不符合我的预期，价格昂贵且不好用。最终，我发现了一个轻量级且有效的能够高度自定义的解决方案——浏览器内置的 [Web Speech API](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=Web+Speech+API&zhida_source=entity)。

## 简介

随着[人工智能技术](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD%E6%8A%80%E6%9C%AF&zhida_source=entity)的迅猛发展，[语音识别技术](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=%E8%AF%AD%E9%9F%B3%E8%AF%86%E5%88%AB%E6%8A%80%E6%9C%AF&zhida_source=entity)已经逐渐走入我们的日常生活。从语音助手到语音输入法，语音转文字（Speech-to-Text）技术为用户提供了更加便捷的交互方式。本文将介绍浏览器内置的Web Speech API，特别是其语音识别功能，并通过一个实践案例展示如何在网页中实现语音转文字功能。

### 什么是Web Speech API？

Web Speech API 是一个由[W3C](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=W3C&zhida_source=entity)制定的Web标准，旨在为Web应用提供语音识别和[语音合成](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=%E8%AF%AD%E9%9F%B3%E5%90%88%E6%88%90&zhida_source=entity)功能。该API主要包括两个部分：

1.  **[SpeechSynthesis](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=SpeechSynthesis&zhida_source=entity)（语音合成）**：允许Web应用将文本转换为语音。
2.  **SpeechRecognition（语音识别）**：允许Web应用将用户的语音输入转换为文本。

本篇文章将重点介绍语音识别部分，即如何使用浏览器的SpeechRecognition API实现语音转文字功能。

### 浏览器的语音识别API

### 浏览器支持情况

Web Speech API 的语音识别功能在现代浏览器中的支持情况如下：

-   **Google Chrome**：支持
-   **[Microsoft Edge](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=Microsoft+Edge&zhida_source=entity)**：支持
-   **[Firefox](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=Firefox&zhida_source=entity)**：暂不支持
-   **[Safari](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=Safari&zhida_source=entity)**：暂不支持

因此，为了确保应用的广泛兼容性，建议主要针对支持该API的浏览器进行开发和测试。

### 基本概念

-   **SpeechRecognition 对象**：用于创建一个语音识别实例。
-   **语音识别事件**：包括 `onstart`、`onerror`、`onend` 和 `onresult` 等，用于处理语音识别过程中的不同状态和结果。

### 实践案例：构建一个基础的语音转文字应用

![图片](https://pica.zhimg.com/v2-822fb5881c737449d632c2ca314d38d0.jpg)

接下来，我们将通过一个实际的例子，展示如何在网页中实现语音转文字功能。该示例包括开始和停止录音的按钮，以及实时显示识别结果的区域。

### 完整代码

```html
<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <title>浏览器内置语音转文字示例</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            text-align: center;
        }

        #transcript {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #ddd;
            min-height: 100px;
            width: 80%;
            margin-left: auto;
            margin-right: auto;
            text-align: left;
            white-space: pre-wrap;
            background-color: #f9f9f9;
            overflow-y: auto;
        }

        button {
            padding: 10px 20px;
            font-size: 16px;
            margin: 5px;
            cursor: pointer;
        }

        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
    </style>
</head>

<body>
    <h1>浏览器内置语音转文字示例</h1>
    <button id="startBtn">开始录音</button>
    <button id="stopBtn" disabled>停止录音</button>
    <div id="transcript">
        {
            "paragraphs": []
        }
    </div>

    <script>
        (function () {
            // 获取页面中的按钮和显示区域
            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            const transcriptDiv = document.getElementById('transcript');

            // 状态变量
            let isRecognizing = false; // 是否正在识别
            let recognition = null; // 语音识别实例
            let speechContent = {
                paragraphs: []
            }; // 存储识别内容
            let currentParagraph = { sentences: [] }; // 当前段落

            // 初始化 Web Speech API
            window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

            // 检查浏览器是否支持语音识别
            if (!window.SpeechRecognition) {
                alert("您的浏览器不支持语音识别。请使用最新版本的 Chrome 或 Edge。");
                startBtn.disabled = true; // 禁用开始按钮
                return;
            }

            // 创建语音识别实例
            recognition = new window.SpeechRecognition();
            recognition.lang = 'zh-CN'; // 设置语言为中文
            recognition.interimResults = true; // 启用中间结果
            recognition.continuous = true; // 启用连续识别

            // 语音识别开始时的回调
            recognition.onstart = () => {
                console.log('语音识别已启动。');
                isRecognizing = true;
                startBtn.disabled = true; // 禁用开始按钮
                stopBtn.disabled = false; // 启用停止按钮
            };

            // 语音识别出错时的回调
            recognition.onerror = (event) => {
                console.error('语音识别错误:', event.error);
                alert(`语音识别错误: ${event.error}`);
                isRecognizing = false;
                startBtn.disabled = false; // 启用开始按钮
                stopBtn.disabled = true; // 禁用停止按钮
            };

            // 语音识别结束时的回调
            recognition.onend = () => {
                console.log('语音识别已结束。');
                isRecognizing = false;
                startBtn.disabled = false; // 启用开始按钮
                stopBtn.disabled = true; // 禁用停止按钮
            };

            // 语音识别结果时的回调
            recognition.onresult = (event) => {
                // 遍历所有识别结果
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcript = result[0].transcript.trim(); // 获取识别的文本
                    const isFinal = result.isFinal; // 是否为最终结果

                    if (isFinal) {
                        // 如果是最终结果，将句子添加到当前段落
                        currentParagraph.sentences.push({ finalTranscript: transcript });
                        speechContent.paragraphs.push(currentParagraph); // 将段落添加到speechContent
                        currentParagraph = { sentences: [] }; // 重置当前段落
                    } else {
                        // 如果是临时结果，更新当前段落的最后一个句子
                        if (currentParagraph.sentences.length === 0) {
                            // 如果当前段落没有句子，添加一个临时句子
                            currentParagraph.sentences.push({ interimTranscript: transcript });
                        } else {
                            // 更新最后一个句子的临时文本
                            currentParagraph.sentences[currentParagraph.sentences.length - 1].interimTranscript = transcript;
                        }
                    }
                }
                updateTranscript(); // 更新显示区域
            };

            // 开始录音按钮的点击事件
            startBtn.addEventListener('click', () => {
                if (recognition && !isRecognizing) {
                    recognition.start(); // 启动语音识别
                    console.log('开始录音...');
                }
            });

            // 停止录音按钮的点击事件
            stopBtn.addEventListener('click', () => {
                if (recognition && isRecognizing) {
                    recognition.stop(); // 停止语音识别
                    console.log('停止录音。');
                }
            });

            // 更新显示区域的函数
            function updateTranscript() {
                // 将speechContent对象格式化为JSON字符串，并显示在页面上
                transcriptDiv.textContent = JSON.stringify(speechContent, null, 2);
            }

            // 初始显示
            updateTranscript();
        })();
    </script>
</body>

</html>
```

### 代码详解

下面将详细解析上述代码的各个部分，帮助您更好地理解其工作原理。

### 1\. HTML结构

```html
<body>
    <h1>浏览器内置语音转文字示例</h1>
    <button id="startBtn">开始录音</button>
    <button id="stopBtn" disabled>停止录音</button>
    <div id="transcript">
        {
            "paragraphs": []
        }
    </div>
    ...
</body>
```

-   **标题**：展示页面的标题。
-   **按钮**：
-   **开始录音按钮 (`startBtn`)**：用户点击后开始语音识别。
-   **停止录音按钮 (`stopBtn`)**：用户点击后停止语音识别。初始状态下被禁用，只有在语音识别启动后才启用。
-   **显示区域 (`transcript`)**：用于实时显示语音识别的结果，初始内容为一个空的JSON对象。

### 2\. CSS样式

```css
body {
    font-family: Arial, sans-serif;
    margin: 40px;
    text-align: center;
}

#transcript {
    margin-top: 20px;
    padding: 10px;
    border: 1px solid #ddd;
    min-height: 100px;
    width: 80%;
    margin-left: auto;
    margin-right: auto;
    text-align: left;
    white-space: pre-wrap;
    background-color: #f9f9f9;
    overflow-y: auto;
}

button {
    padding: 10px 20px;
    font-size: 16px;
    margin: 5px;
    cursor: pointer;
}

button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
}
```

-   **页面样式**：设置字体、边距和对齐方式，使页面看起来简洁美观。
-   **按钮样式**：设置按钮的大小、字体和鼠标指针样式。禁用状态下，按钮颜色变灰，鼠标指针变为“禁止”状态。

### 3\. JavaScript逻辑

```js
(function () {
    // 获取页面中的按钮和显示区域
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const transcriptDiv = document.getElementById('transcript');

    // 状态变量
    let isRecognizing = false; // 是否正在识别
    let recognition = null; // 语音识别实例
    let speechContent = {
        paragraphs: []
    }; // 存储识别内容
    let currentParagraph = { sentences: [] }; // 当前段落

    // 初始化 Web Speech API
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

    // 检查浏览器是否支持语音识别
    if (!window.SpeechRecognition) {
        alert("您的浏览器不支持语音识别。请使用最新版本的 Chrome 或 Edge。");
        startBtn.disabled = true; // 禁用开始按钮
        return;
    }

    // 创建语音识别实例
    recognition = new window.SpeechRecognition();
    recognition.lang = 'zh-CN'; // 设置语言为中文
    recognition.interimResults = true; // 启用中间结果
    recognition.continuous = true; // 启用连续识别

    // 语音识别开始时的回调
    recognition.onstart = () => {
        console.log('语音识别已启动。');
        isRecognizing = true;
        startBtn.disabled = true; // 禁用开始按钮
        stopBtn.disabled = false; // 启用停止按钮
    };

    // 语音识别出错时的回调
    recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        alert(`语音识别错误: ${event.error}`);
        isRecognizing = false;
        startBtn.disabled = false; // 启用开始按钮
        stopBtn.disabled = true; // 禁用停止按钮
    };

    // 语音识别结束时的回调
    recognition.onend = () => {
        console.log('语音识别已结束。');
        isRecognizing = false;
        startBtn.disabled = false; // 启用开始按钮
        stopBtn.disabled = true; // 禁用停止按钮
    };

    // 语音识别结果时的回调
    recognition.onresult = (event) => {
        // 遍历所有识别结果
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript.trim(); // 获取识别的文本
            const isFinal = result.isFinal; // 是否为最终结果

            if (isFinal) {
                // 如果是最终结果，将句子添加到当前段落
                currentParagraph.sentences.push({ finalTranscript: transcript });
                speechContent.paragraphs.push(currentParagraph); // 将段落添加到speechContent
                currentParagraph = { sentences: [] }; // 重置当前段落
            } else {
                // 如果是临时结果，更新当前段落的最后一个句子
                if (currentParagraph.sentences.length === 0) {
                    // 如果当前段落没有句子，添加一个临时句子
                    currentParagraph.sentences.push({ interimTranscript: transcript });
                } else {
                    // 更新最后一个句子的临时文本
                    currentParagraph.sentences[currentParagraph.sentences.length - 1].interimTranscript = transcript;
                }
            }
        }
        updateTranscript(); // 更新显示区域
    };

    // 开始录音按钮的点击事件
    startBtn.addEventListener('click', () => {
        if (recognition && !isRecognizing) {
            recognition.start(); // 启动语音识别
            console.log('开始录音...');
        }
    });

    // 停止录音按钮的点击事件
    stopBtn.addEventListener('click', () => {
        if (recognition && isRecognizing) {
            recognition.stop(); // 停止语音识别
            console.log('停止录音。');
        }
    });

    // 更新显示区域的函数
    function updateTranscript() {
        // 将speechContent对象格式化为JSON字符串，并显示在页面上
        transcriptDiv.textContent = JSON.stringify(speechContent, null, 2);
    }

    // 初始显示
    updateTranscript();
})();
```

### 3.1 [自执行函数](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=%E8%87%AA%E6%89%A7%E8%A1%8C%E5%87%BD%E6%95%B0&zhida_source=entity)

```js
(function () {
    // ...代码内容...
})();
```

使用立即执行函数（IIFE）包裹所有JavaScript代码，避免全局[命名空间](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=%E5%91%BD%E5%90%8D%E7%A9%BA%E9%97%B4&zhida_source=entity)污染。

### 3.2 获取页面元素

```js
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const transcriptDiv = document.getElementById('transcript');
```

通过 `document.getElementById` 获取页面中的开始和停止按钮，以及显示识别结果的 `div`。

### 3.3 状态变量

```js
let isRecognizing = false; // 是否正在识别
let recognition = null; // 语音识别实例
let speechContent = {
    paragraphs: []
}; // 存储识别内容
let currentParagraph = { sentences: [] }; // 当前段落
```

-   **isRecognizing**：标记当前是否正在进行语音识别。
-   **recognition**：存储 `SpeechRecognition` 实例。
-   **speechContent**：用于存储所有识别到的内容，结构为段落和句子。
-   **currentParagraph**：用于临时存储当前正在识别的段落。

### 3.4 初始化 Web Speech API

```js
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
```

兼容不同浏览器的前缀，确保在支持的浏览器中正确初始化 `SpeechRecognition`。

### 3.5 检查浏览器支持情况

```js
if (!window.SpeechRecognition) {
    alert("您的浏览器不支持语音识别。请使用最新版本的 Chrome 或 Edge。");
    startBtn.disabled = true; // 禁用开始按钮
    return;
}
```

如果浏览器不支持语音识别，提示用户并禁用开始录音按钮。

### 3.6 创建语音识别实例

```js
recognition = new window.SpeechRecognition();
recognition.lang = 'zh-CN'; // 设置语言为中文
recognition.interimResults = true; // 启用中间结果
recognition.continuous = true; // 启用连续识别
```

-   **lang**：设置识别语言为中文。
-   **interimResults**：启用临时结果，即在用户说话过程中实时返回部分识别结果。
-   **continuous**：启用连续识别，即在用户说话结束后继续监听下一次说话。

### 3.7 处理语音识别事件

### 3.7.1 识别开始

```js
recognition.onstart = () => {
    console.log('语音识别已启动。');
    isRecognizing = true;
    startBtn.disabled = true; // 禁用开始按钮
    stopBtn.disabled = false; // 启用停止按钮
};
```

当语音识别启动时，更新状态变量，禁用开始按钮，启用停止按钮，并在控制台打印日志。

### 3.7.2 识别出错

```js
recognition.onerror = (event) => {
    console.error('语音识别错误:', event.error);
    alert(`语音识别错误: ${event.error}`);
    isRecognizing = false;
    startBtn.disabled = false; // 启用开始按钮
    stopBtn.disabled = true; // 禁用停止按钮
};
```

当语音识别过程中发生错误时，显示错误信息，更新状态变量，并调整按钮状态。

### 3.7.3 识别结束

```js
recognition.onend = () => {
    console.log('语音识别已结束。');
    isRecognizing = false;
    startBtn.disabled = false; // 启用开始按钮
    stopBtn.disabled = true; // 禁用停止按钮
};
```

当语音识别结束时，更新状态变量，启用开始按钮，禁用停止按钮，并在控制台打印日志。

### 3.7.4 处理识别结果

```js
recognition.onresult = (event) => {
    // 遍历所有识别结果
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim(); // 获取识别的文本
        const isFinal = result.isFinal; // 是否为最终结果

        if (isFinal) {
            // 如果是最终结果，将句子添加到当前段落
            currentParagraph.sentences.push({ finalTranscript: transcript });
            speechContent.paragraphs.push(currentParagraph); // 将段落添加到speechContent
            currentParagraph = { sentences: [] }; // 重置当前段落
        } else {
            // 如果是临时结果，更新当前段落的最后一个句子
            if (currentParagraph.sentences.length === 0) {
                // 如果当前段落没有句子，添加一个临时句子
                currentParagraph.sentences.push({ interimTranscript: transcript });
            } else {
                // 更新最后一个句子的临时文本
                currentParagraph.sentences[currentParagraph.sentences.length - 1].interimTranscript = transcript;
            }
        }
    }
    updateTranscript(); // 更新显示区域
};
```

-   **event.resultIndex**：表示当前识别结果的起始索引。
-   **event.results**：包含所有识别结果的数组。

对于每一个识别结果：

1.  **获取识别文本**：通过 `result[0].transcript` 获取识别到的文本，并使用 `trim()` 去除首尾空白字符。
2.  **判断是否为最终结果**：
3.  **最终结果 (`isFinal = true`)**：

-   将识别的句子作为最终文本添加到当前段落。
-   将当前段落添加到 `speechContent.paragraphs`。
-   重置 `currentParagraph` 以开始新的段落。

1.  **临时结果 (`isFinal = false`)**：

-   如果当前段落没有句子，添加一个包含临时文本的句子。
-   否则，更新当前段落最后一个句子的临时文本。

最后，调用 `updateTranscript()` 函数更新显示区域。

### 3.8 按钮事件处理

```js
// 开始录音按钮的点击事件
startBtn.addEventListener('click', () => {
    if (recognition && !isRecognizing) {
        recognition.start(); // 启动语音识别
        console.log('开始录音...');
    }
});

// 停止录音按钮的点击事件
stopBtn.addEventListener('click', () => {
    if (recognition && isRecognizing) {
        recognition.stop(); // 停止语音识别
        console.log('停止录音。');
    }
});
```

-   **开始录音按钮**：点击后，启动语音识别，并在控制台打印“开始录音...”。
-   **停止录音按钮**：点击后，停止语音识别，并在控制台打印“停止录音。”。

### 3.9 更新显示区域

```js
// 更新显示区域的函数
function updateTranscript() {
    // 将speechContent对象格式化为JSON字符串，并显示在页面上
    transcriptDiv.textContent = JSON.stringify(speechContent, null, 2);
}

// 初始显示
updateTranscript();
```

-   **updateTranscript()**：将 `speechContent` 对象格式化为带有缩进的JSON字符串，并显示在 `transcript` 区域。
-   **初始显示**：在页面加载时，调用 `updateTranscript()` 显示初始的空JSON对象。

### 功能说明

通过上述代码，我们实现了一个简单的语音转文字应用，其主要功能包括：

1.  **开始录音**：用户点击“开始录音”按钮后，浏览器开始监听用户的语音输入。
2.  **停止录音**：用户点击“停止录音”按钮后，浏览器停止监听语音输入。
3.  **实时显示**：识别到的语音内容以JSON格式实时显示在页面上，支持多轮对话和段落划分。
4.  **错误处理**：如果浏览器不支持语音识别，或在识别过程中发生错误，应用会提示用户并相应调整按钮状态。

### 运行效果

当用户点击“开始录音”按钮后，浏览器会请求麦克风权限，并开始监听用户的语音输入。用户说话时，语音识别结果会实时显示在页面上的 `transcript` 区域。当用户点击“停止录音”按钮，语音识别将停止，按钮状态也会相应更新。

以下是一个示例的识别结果显示：

```json
{
  "paragraphs": [
    {
      "sentences": [
        {
          "finalTranscript": "你好，我正在测试语音识别功能。"
        }
      ]
    },
    {
      "sentences": [
        {
          "finalTranscript": "这是一个多段落的测试。"
        }
      ]
    }
  ]
}
```

### 注意事项

1.  **隐私与权限**：语音识别需要麦克风权限。确保用户知情并同意使用麦克风。
2.  **[浏览器兼容性](https://zhida.zhihu.com/search?content_id=248373796&content_type=Article&match_order=1&q=%E6%B5%8F%E8%A7%88%E5%99%A8%E5%85%BC%E5%AE%B9%E6%80%A7&zhida_source=entity)**：如前所述，确保在支持Web Speech API的浏览器中运行应用。
3.  **网络连接**：某些浏览器的语音识别功能需要网络连接，因为语音识别可能在服务器端进行处理。
4.  **语言支持**：设置正确的 `lang` 属性，确保识别结果的准确性。本示例中设置为中文（`zh-CN`）。

### 结论

通过本文的介绍和实践案例，我们了解了如何使用浏览器内置的Web Speech API实现语音转文字功能。该技术不仅能够提升用户体验，还为开发更加智能化的Web应用提供了可能。未来，随着Web Speech API的不断完善和浏览器支持的扩大，语音交互将成为Web应用的重要组成部分。

希望本文能够帮助您快速上手Web Speech API，实现自己的语音转文字应用。如果您有任何问题或建议，欢迎在下方留言讨论！