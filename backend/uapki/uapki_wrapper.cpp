#include <iostream>
#include <string>
#include <fstream>

// Експортуємо нативну функцію з ядра libuapki.so
extern "C" char* process(const char* request);

int main(int argc, char* argv[]) {
    if (argc != 2) {
        std::cerr << "Usage: " << argv[0] << " <json_file_path>" << std::endl;
        return 1;
    }

    // Отримуємо шлях до JSON файлу
    std::string json_file_path = argv[1];

    if (json_file_path.empty()) {
        std::cerr << "{\"error\": \"Empty JSON file path\"}" << std::endl;
        return 1;
    }

    // Зчитуємо JSON з файлу
    std::ifstream file(json_file_path);
    if (!file.is_open()) {
        std::cerr << "{\"error\": \"Failed to open file: " << json_file_path << "\"}" << std::endl;
        return 1;
    }

    std::string json_request((std::istreambuf_iterator<char>(file)),
                           std::istreambuf_iterator<char>());
    file.close();

    if (json_request.empty()) {
        std::cerr << "{\"error\": \"Empty JSON file\"}" << std::endl;
        return 1;
    }

    // Передаємо СИРИЙ JSON безпосередньо в рідне ядро UAPKI
    // Ядро саме розпарсить "params", "signatures", "hashAlgo" та відпрацює з TSP
    char* json_response = process(json_request.c_str());

    if (json_response != nullptr) {
        // Виводимо чистий JSON результат назад у Python
        std::cout << json_response << std::endl;
    } else {
        std::cerr << "{\"error\": \"UAPKI native core returned null\"}" << std::endl;
        return 1;
    }

    return 0;
}
