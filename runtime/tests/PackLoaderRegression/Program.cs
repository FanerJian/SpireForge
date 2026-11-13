using FileAccess = Godot.FileAccess;
using MegaCrit.Sts2.Core.Logging;
using SpireForge.Runtime;

const ulong maximum = 16 * 1024 * 1024;
const string directory = "res://TestPack/cards/";
FileAccess.Files[directory + "oversized.json"] = (maximum + 1, "{\"id\":\"oversized\"}");
FileAccess.Files[directory + "broken.json"] = (1, "{");
FileAccess.Files[directory + "valid.json"] = (17, "{\"id\":\"valid\"}");
FileAccess.Files[directory + "boundary.json"] = (maximum, "{\"id\":\"boundary\"}");
PackLoader.ScanAllMods();

void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
    Console.WriteLine("PASS " + message);
}

Check(FileAccess.OpenCounts[directory + "oversized.json"] == 1,
    "Oversized cards advance directory enumeration after one inspection");
Check(!FileAccess.TextReads.Contains(directory + "oversized.json"),
    "Oversized cards are rejected before allocating their JSON text");
Check(PackLoader.Defs.Values.Select(card => card.Id).Order().SequenceEqual(new[] { "boundary", "valid" }),
    "Valid cards following oversized and malformed entries load normally");
Check(FileAccess.TextReads.Contains(directory + "boundary.json"),
    "Cards at the exact 16 MiB boundary remain supported");
Check(Log.Errors.Count == 2 && Log.Errors.Any(message => message.Contains("16 MiB")),
    "Each rejected card produces one diagnostic while scanning continues");
