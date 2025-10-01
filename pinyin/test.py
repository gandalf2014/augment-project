import requests

url = "https://gxt.hebei.gov.cn/hbgyhxxht/xwzx32/tzgg83/2025050709015579530/2025050709005484484.pdf"
output_file = "公告.pdf"   # 保存文件名，可以改成别的

response = requests.get(url, stream=True)
response.raise_for_status()  # 如果下载失败会抛出异常

with open(output_file, "wb") as f:
    for chunk in response.iter_content(chunk_size=8192):
        if chunk:  # 过滤掉 keep-alive 的空块
            f.write(chunk)

print(f"文件已保存为: {output_file}")
