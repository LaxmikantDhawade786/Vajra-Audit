# get_vajra_machine_id.py
import platform, subprocess, hashlib, os, re

def generate_hardware_fingerprint():
    system = platform.system()
    unique_string = ""

    try:
        if system == "Windows":
            try:
                uuid_out = subprocess.check_output("wmic csproduct get uuid", shell=True).decode(errors="ignore").split("\n")[1].strip()
                unique_string += uuid_out
            except:
                pass
            try:
                vol_out = subprocess.check_output("vol C:", shell=True).decode(errors="ignore")
                m = re.search(r"Serial Number is ([\w-]+)", vol_out)
                if m:
                    unique_string += m.group(1)
            except:
                pass

        elif system == "Linux":
            try:
                with open("/etc/machine-id","r") as f:
                    unique_string += f.read().strip()
            except:
                pass
            try:
                disk_uuid = subprocess.check_output("blkid -s UUID -o value /dev/sda1", shell=True).decode().strip()
                unique_string += disk_uuid
            except:
                pass

        elif system == "Darwin":
            try:
                uuid = subprocess.check_output("ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID", shell=True).decode()
                m = re.search(r'"IOPlatformUUID" = "(.+)"', uuid)
                if m:
                    unique_string += m.group(1)
            except:
                pass

    except Exception as e:
        pass

    if not unique_string:
        unique_string = platform.node() + platform.version()

    return hashlib.sha256(unique_string.encode()).hexdigest()[:12].upper()

if __name__ == "__main__":
    print("\n===== Vajra Machine ID =====")
    print(generate_hardware_fingerprint())
    print("\nCopy & paste this ID into the purchase/activation page.\n")